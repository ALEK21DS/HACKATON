import { Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ffmpeg-static/ffprobe-static exponen el binario vía `module.exports =`, sin interop
// de default export en este tsconfig (esModuleInterop no está activo) — se usa require directo.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegStatic: string | null = require('ffmpeg-static');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobeStatic: { path: string } = require('ffprobe-static');

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const logger = new Logger('VideoTranscode');

function probeVideoCodec(filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        logger.warn(`No se pudo analizar el video: ${err.message}`);
        resolve(null);
        return;
      }
      const videoStream = data.streams?.find((s) => s.codec_type === 'video');
      resolve(videoStream?.codec_name ?? null);
    });
  });
}

/**
 * WhatsApp Cloud API solo procesa video H.264 (AVC) + audio AAC en MP4.
 * Los videos HEVC/H.265 (comunes en iPhone) son aceptados al subir pero
 * rechazados después, de forma asíncrona (error 131053). Si el video no
 * viene en H.264, lo recodifica antes de enviarlo.
 */
export async function ensureWhatsAppCompatibleVideo(
  buffer: Buffer,
  mimetype: string,
): Promise<{ buffer: Buffer; mimetype: string; transcoded: boolean }> {
  if (!mimetype.startsWith('video/')) {
    return { buffer, mimetype, transcoded: false };
  }

  const inputPath = join(tmpdir(), `${randomUUID()}_in`);
  const outputPath = join(tmpdir(), `${randomUUID()}_out.mp4`);

  try {
    await fs.writeFile(inputPath, buffer);
    const codec = await probeVideoCodec(inputPath);
    if (codec === 'h264') {
      return { buffer, mimetype, transcoded: false };
    }

    logger.log(`Recodificando video de códec "${codec ?? 'desconocido'}" a H.264 para compatibilidad con WhatsApp`);

    const TRANSCODE_TIMEOUT_MS = 120_000;
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // "veryfast" prioriza velocidad sobre tamaño: evita que un video largo
        // deje la subida colgada; el tamaño sigue acotado por -crf.
        .outputOptions(['-preset veryfast', '-crf 26', '-pix_fmt yuv420p', '-movflags +faststart'])
        .format('mp4')
        .on('error', reject)
        .on('end', () => resolve());

      const timer = setTimeout(() => {
        command.kill('SIGKILL');
        reject(new Error(`Recodificación excedió ${TRANSCODE_TIMEOUT_MS / 1000}s`));
      }, TRANSCODE_TIMEOUT_MS);

      command.save(outputPath);
      command.on('end', () => clearTimeout(timer));
      command.on('error', () => clearTimeout(timer));
    });

    const transcodedBuffer = await fs.readFile(outputPath);
    return { buffer: transcodedBuffer, mimetype: 'video/mp4', transcoded: true };
  } catch (err) {
    logger.error(`Fallo al recodificar el video, se enviará el original: ${err instanceof Error ? err.message : err}`);
    return { buffer, mimetype, transcoded: false };
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

/** Reemplaza la extensión de un nombre de archivo por .mp4, usado cuando el video fue recodificado. */
export function withMp4Extension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '') + '.mp4';
}

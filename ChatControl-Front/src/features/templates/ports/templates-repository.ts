import type { MessageTemplate } from '@/entities/template';

export interface TemplatesRepository {
  getTemplatesFromMeta(): Promise<MessageTemplate[]>;
  getTemplatesList(): Promise<MessageTemplate[]>;
  getTemplate(id: string): Promise<{ ok: boolean; template: MessageTemplate | null }>;
  createTemplate(params: { name: string; body: string }): Promise<{ ok: boolean; template: MessageTemplate }>;
  updateTemplate(id: string, params: { name?: string; body?: string }): Promise<{ ok: boolean; template: MessageTemplate }>;
  deleteTemplate(id: string): Promise<{ ok: boolean }>;
}

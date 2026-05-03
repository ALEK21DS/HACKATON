'use client';

import { useState } from 'react';
import type { PlatformAuditLogRow, PlatformOrganization } from '@/lib/api';

type PlatformAuditTableProps = {
  audit: PlatformAuditLogRow[];
  organizations: PlatformOrganization[];
  selectedOrgId: string;
  onChangeOrganizationId: (value: string) => void;
};

// Map action codes to human-readable Spanish labels
const ACTION_LABELS: Record<string, string> = {
  ORG_CREATED: 'Empresa creada',
  ORG_RENAMED: 'Empresa renombrada',
  ORG_STATUS_CHANGED: 'Estado cambiado',
  ORG_FIRST_ADMIN_CREATED: 'Primer admin creado',
  ORG_ADMIN_PASSWORD_RESET: 'Contraseña de admin reseteada',
};

// Color badge per action type
function actionBadge(action: string) {
  const label = ACTION_LABELS[action] ?? action;
  let cls = 'bg-[#1A1A1A] text-[#8C8C8C] border-[#404040]/30';
  if (action === 'ORG_CREATED') cls = 'bg-green-500/10 text-green-400 border-green-500/20';
  if (action === 'ORG_RENAMED') cls = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (action === 'ORG_STATUS_CHANGED') cls = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  if (action === 'ORG_FIRST_ADMIN_CREATED') cls = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  if (action === 'ORG_ADMIN_PASSWORD_RESET') cls = 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
  return { label, cls };
}

// Format metadata into readable lines
function formatMetadata(action: string, metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const m = metadata as Record<string, unknown>;
  const lines: string[] = [];

  if (action === 'ORG_CREATED' || action === 'ORG_RENAMED') {
    if (m.name) lines.push(`Nombre: ${m.name}`);
    if (m.previous) lines.push(`Anterior: ${m.previous}`);
    if (m.next) lines.push(`Nuevo: ${m.next}`);
    if (m.withFirstAdmin !== undefined) lines.push(`Con primer admin: ${m.withFirstAdmin ? 'Sí' : 'No'}`);
  } else if (action === 'ORG_STATUS_CHANGED') {
    if (m.previous) lines.push(`Estado anterior: ${m.previous}`);
    if (m.next) lines.push(`Nuevo estado: ${m.next}`);
  } else if (action === 'ORG_FIRST_ADMIN_CREATED') {
    if (m.email) lines.push(`Correo: ${m.email}`);
    if (m.bootstrap) lines.push('Método: Bootstrap inicial');
  } else if (action === 'ORG_ADMIN_PASSWORD_RESET') {
    if (m.adminEmail) lines.push(`Admin: ${m.adminEmail}`);
  } else {
    Object.entries(m).forEach(([k, v]) => lines.push(`${k}: ${JSON.stringify(v)}`));
  }
  return lines;
}

// Details Modal
function AuditDetailModal({
  row,
  orgName,
  onClose,
}: {
  row: PlatformAuditLogRow;
  orgName: string;
  onClose: () => void;
}) {
  const { label, cls } = actionBadge(row.action);
  const lines = formatMetadata(row.action, row.metadata);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0d0d0d] rounded-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] text-[#F2F2F2]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#404040]/30">
          <h2 className="font-headline font-bold text-lg">Detalle de auditoría</h2>
          <button onClick={onClose} className="text-[#8C8C8C] hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Action badge */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2">Acción</p>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${cls}`}>
              {label}
            </span>
          </div>

          {/* Grid of meta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-1">Fecha</p>
              <p className="text-sm text-white">{new Date(row.createdAt).toLocaleString('es-ES')}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-1">Actor</p>
              <p className="text-sm text-white truncate">{row.actor.email}</p>
            </div>
            {row.actor.displayName && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-1">Nombre del actor</p>
                <p className="text-sm text-white">{row.actor.displayName}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-1">Empresa afectada</p>
              <p className="text-sm text-white">{orgName}</p>
            </div>
          </div>

          {/* Metadata details */}
          {lines.length > 0 && (
            <div className="bg-[#151515] rounded-xl p-4 border border-[#404040]/30 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-3">Detalles del cambio</p>
              {lines.map((line, i) => {
                const colonIdx = line.indexOf(':');
                const key = colonIdx >= 0 ? line.slice(0, colonIdx) : line;
                const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
                return (
                  <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-[#404040]/20 last:border-0">
                    <span className="text-[#8C8C8C]">{key}</span>
                    <span className="text-white font-medium ml-4 text-right">{val}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlatformAuditTable({
  audit,
  organizations,
  selectedOrgId,
  onChangeOrganizationId,
}: PlatformAuditTableProps) {
  const [selectedRow, setSelectedRow] = useState<PlatformAuditLogRow | null>(null);

  const orgMap = Object.fromEntries(organizations.map((o) => [o.id, o.name]));

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold shrink-0">
          Empresa afectada
        </label>
        <select
          value={selectedOrgId}
          onChange={(e) => onChangeOrganizationId(e.target.value)}
          className="bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-2 px-3 text-[#F2F2F2] focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm min-w-[220px]"
        >
          <option value="">Todas las empresas</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <span className="text-[10px] text-[#8C8C8C] font-bold ml-auto">
          {audit.length} registro{audit.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table — no horizontal scroll, full width layout */}
      {audit.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[#8C8C8C] text-sm uppercase tracking-widest font-bold">Sin registros de auditoría.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#404040]/30 overflow-hidden">
          <table className="w-full text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[160px]" />
              <col className="w-[220px]" />
              <col className="w-[180px]" />
              <col className="w-[140px]" />
              <col className="w-[90px]" />
            </colgroup>
            <thead className="bg-[#151515] text-[10px] uppercase tracking-widest font-bold text-[#F2F2F2]">
              <tr>
                <th className="px-5 py-4 font-medium">Fecha</th>
                <th className="px-5 py-4 font-medium">Acción</th>
                <th className="px-5 py-4 font-medium">Actor</th>
                <th className="px-5 py-4 font-medium">Empresa</th>
                <th className="px-5 py-4 font-medium text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#404040]/20 bg-[#0A0A0A]/60">
              {audit.map((a) => {
                const { label, cls } = actionBadge(a.action);
                const orgName = a.targetOrganizationId
                  ? (orgMap[a.targetOrganizationId] ?? 'Empresa desconocida')
                  : '—';
                return (
                  <tr key={a.id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#F2F2F2]">
                      {new Date(a.createdAt).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#F2F2F2] text-xs truncate max-w-0">
                      <span className="block truncate" title={a.actor.email}>{a.actor.email}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#F2F2F2] text-xs font-semibold truncate max-w-0">
                      <span className="block truncate" title={orgName}>{orgName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(a)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#8C8C8C] hover:text-[#EF4444] transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRow && (
        <AuditDetailModal
          row={selectedRow}
          orgName={
            selectedRow.targetOrganizationId
              ? (orgMap[selectedRow.targetOrganizationId] ?? 'Empresa desconocida')
              : '—'
          }
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}

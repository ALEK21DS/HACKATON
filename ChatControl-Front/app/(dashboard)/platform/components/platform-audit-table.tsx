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
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#404040]/30">
          <h2 className="font-headline font-bold text-lg">Detalle de auditoría</h2>
          <button onClick={onClose} className="text-[#8C8C8C] hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2">Acción</p>
            <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold border ${cls}`}>
              {label}
            </span>
          </div>

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
  loading = false,
}: PlatformAuditTableProps & { loading?: boolean }) {
  const [selectedRow, setSelectedRow] = useState<PlatformAuditLogRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const orgMap = Object.fromEntries(organizations.map((o) => [o.id, o.name]));

  // Pagination Logic
  const totalPages = Math.ceil(audit.length / pageSize);
  const paginatedAudit = audit.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-widest text-[#444] font-black shrink-0">
            Empresa afectada
          </label>
          <div className="relative flex items-center">
            <select
              value={selectedOrgId}
              onChange={(e) => { onChangeOrganizationId(e.target.value); setCurrentPage(1); }}
              className="bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[#F2F2F2] outline-none text-sm cursor-pointer appearance-none pr-10 min-w-[220px]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem'
              }}
            >
              <option value="" className="bg-[#0d0d0d]">Todas las empresas</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0d0d0d]">{o.name}</option>
              ))}
            </select>
          </div>
        </div>
        <span className="text-[10px] text-[#444] font-black uppercase tracking-widest ml-auto">
          {audit.length} registro{audit.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white/[0.01] border border-white/5 rounded-2xl">
          <div className="pulse-logo-audit mb-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-[10px] font-black text-[#444] uppercase tracking-[0.2rem] animate-pulse">Analizando Logs</p>
          <style jsx>{`
            .pulse-logo-audit {
              animation: pulse-audit 1.5s ease-in-out infinite;
              filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.3));
            }
            @keyframes pulse-audit {
              0% { transform: scale(0.9); opacity: 0.4; }
              50% { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0.4; }
            }
          `}</style>
        </div>
      ) : audit.length === 0 ? (
        <div className="py-20 text-center bg-white/[0.01] border border-white/5 rounded-2xl">
          <p className="text-[#444] text-[10px] uppercase tracking-[0.2rem] font-black">Sin registros de auditoría</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-white/[0.02]">
            <table className="w-full text-left text-sm table-fixed">
              <colgroup>
                <col className="w-[160px]" />
                <col className="w-[200px]" />
                <col className="w-[180px]" />
                <col className="w-[140px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.2rem] font-black text-[#8C8C8C] border-b border-white/10">
                <tr>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Acción</th>
                  <th className="px-5 py-4">Actor</th>
                  <th className="px-5 py-4">Empresa</th>
                  <th className="px-5 py-4 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedAudit.map((a) => {
                  const { label, cls } = actionBadge(a.action);
                  const orgName = a.targetOrganizationId
                    ? (orgMap[a.targetOrganizationId] ?? 'Empresa desconocida')
                    : '—';
                  return (
                    <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#8C8C8C]">
                        {new Date(a.createdAt).toLocaleString('es-ES', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${cls}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#F2F2F2] text-xs truncate">
                        <span className="block truncate" title={a.actor.email}>{a.actor.email}</span>
                      </td>
                      <td className="px-5 py-3.5 text-white text-xs font-bold truncate">
                        <span className="block truncate" title={orgName}>{orgName}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(a)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[#EF4444] text-[10px] font-black uppercase tracking-wider hover:bg-[#EF4444] hover:text-white transition-all"
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

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6 px-2">
              <span className="text-[10px] font-black text-[#444] uppercase tracking-widest">
                Viendo <strong className="text-[#8C8C8C]">{paginatedAudit.length}</strong> de <strong className="text-[#8C8C8C]">{audit.length}</strong> logs
              </span>
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.15em]">
                  Página <strong className="text-white">{currentPage}</strong> de <strong className="text-white">{totalPages}</strong>
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => { setCurrentPage(p => p - 1); }}
                    className={`p-2 rounded-lg border transition-all ${currentPage === 1 ? 'border-white/5 text-[#444] cursor-not-allowed' : 'border-white/10 text-white hover:border-[#EF4444]'}`}
                  >
                    <svg width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => { setCurrentPage(p => p + 1); }}
                    className={`p-2 rounded-lg border transition-all ${currentPage === totalPages ? 'border-white/5 text-[#444] cursor-not-allowed' : 'border-white/10 text-white hover:border-[#EF4444]'}`}
                  >
                    <svg width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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

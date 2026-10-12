'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Building2, Check, Copy, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck, UserMinus, Users, X } from 'lucide-react';
import type { UnitDetail, UnitInvite } from '@/lib/units';
import type { Lang, Snapshot } from './types';

type UnitSnapshot = { units: UnitDetail[]; ownedUnitId: string | null };
type UnitResponse = UnitSnapshot & { invitation?: UnitInvite; inviteCode?: string | null; duplicate?: boolean; code?: string; error?: string };
type Secret = { unitId: string; invitation: UnitInvite; code: string };
const SIGN_IN = '/signin-with-chatgpt?return_to=%2F%3Fview%3Dunits';

export function UnitsPage({ lang, ready, data, onAccount, onClasses }: { lang: Lang; ready: boolean; data: Snapshot; onAccount: () => void; onClasses: () => void }) {
  const pt = lang === 'pt';
  const tr = (en: string, portuguese: string) => pt ? portuguese : en;
  const signedIn = data.identity?.mode === 'account';
  const [expired, setExpired] = useState(false);
  const [snapshot, setSnapshot] = useState<UnitSnapshot>({ units: [], ownedUnitId: null });
  const [selectedId, setSelectedId] = useState('');
  const [unitName, setUnitName] = useState('StrikeX · Unidade de teste');
  const [displayName, setDisplayName] = useState(() => (data.profile?.name || data.identity?.displayName || '').slice(0, 60));
  const [joinName, setJoinName] = useState(() => (data.profile?.name || data.identity?.displayName || '').slice(0, 60));
  const [code, setCode] = useState('');
  const [inviteRole, setInviteRole] = useState<'coach' | 'athlete'>('athlete');
  const [secret, setSecret] = useState<Secret | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const loadingRef = useRef(false);
  const epoch = useRef(0);
  const createId = useRef<{ key: string; id: string } | null>(null);
  const inviteId = useRef<{ key: string; id: string } | null>(null);
  const secretInput = useRef<HTMLInputElement>(null);
  const unitPanel = useRef<HTMLElement>(null);
  const errorPanel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready) return;
    const name = (data.profile?.name || data.identity?.displayName || '').slice(0, 60);
    setDisplayName(previous => previous || name);
    setJoinName(previous => previous || name);
  }, [ready, data.profile?.name, data.identity?.displayName]);

  const apply = useCallback((next: UnitSnapshot) => {
    setSnapshot(next);
    setSelectedId(previous => next.units.some(u => u.id === previous) ? previous : next.ownedUnitId || next.units[0]?.id || '');
    setSecret(previous => previous && next.units.find(u => u.id === previous.unitId)?.invitations?.some(i => i.id === previous.invitation.id && i.status === 'pending') ? previous : null);
  }, []);
  const refresh = useCallback(async () => {
    if (loadingRef.current || busyRef.current) return;
    loadingRef.current = true;
    const version = epoch.current;
    try {
      const response = await fetch('/api/units', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (response.status === 401) {
        if (mounted.current && epoch.current === version) { setExpired(true); setSnapshot({ units: [], ownedUnitId: null }); setSecret(null); }
        return;
      }
      if (!response.ok) throw new Error('units');
      const next = await response.json() as UnitSnapshot;
      if (!mounted.current || epoch.current !== version) return;
      apply(next); setLoaded(true); setSyncFailed(false);
    } catch { if (mounted.current && epoch.current === version) setSyncFailed(true); }
    finally { loadingRef.current = false; }
  }, [apply]);
  useEffect(() => {
    mounted.current = true;
    if (!ready || !signedIn || expired) return () => { mounted.current = false; epoch.current++; };
    void refresh();
    const poll = setInterval(() => void refresh(), 15000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; epoch.current++; clearInterval(poll); document.removeEventListener('visibilitychange', visible); };
  }, [ready, signedIn, expired, refresh]);
  useEffect(() => { if (error) errorPanel.current?.focus(); }, [error]);
  const unit = snapshot.units.find(u => u.id === selectedId);
  const disabled = busy || syncFailed || !loaded;
  const roleName = (role: string) => ({ owner: tr('Manager', 'Gestor'), coach: 'Coach', athlete: tr('Athlete', 'Atleta') })[role] || role;
  const inviteStatus = (status: string) => ({ pending: tr('Available', 'Disponível'), used: tr('Used', 'Utilizado'), revoked: tr('Revoked', 'Revogado'), expired: tr('Expired', 'Expirado') })[status] || status;

  async function perform(body: Record<string, unknown>): Promise<UnitResponse | null> {
    if (busyRef.current) return null;
    busyRef.current = true; epoch.current++; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/units', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const result = await response.json() as UnitResponse;
      if (!mounted.current) return null;
      if (response.status === 401) { setExpired(true); setSnapshot({ units: [], ownedUnitId: null }); setSecret(null); return null; }
      if (!response.ok) {
        const messages: Record<string, string> = {
          INVALID_INPUT: tr('Check names, invitation code and selected role.', 'Confira os nomes, o código do convite e o papel selecionado.'),
          INVALID_INVITE: tr('The invitation is invalid, expired, revoked or already used. Ask the manager for a new code.', 'O convite é inválido, expirou, foi revogado ou já foi usado. Peça um novo código ao gestor.'),
          ALREADY_MEMBER: tr('You already belong to this unit. Only its manager can change your role.', 'Você já participa desta unidade. Apenas o gestor pode alterar seu papel.'),
          FORBIDDEN: tr('Your current role does not allow this action.', 'Seu papel atual não permite esta ação.'),
          NOT_FOUND: tr('This unit or member is no longer available to your account.', 'Esta unidade ou pessoa não está mais disponível para sua conta.'),
          UNIT_LIMIT: tr('Limit reached: one managed test unit and up to ten joined units per account.', 'Limite atingido: uma unidade de teste própria e até dez unidades por convite em cada conta.'),
          MEMBER_LIMIT: tr('This test unit has reached its limit of 50 people.', 'Esta unidade de teste atingiu o limite de 50 pessoas.'),
          INVITE_LIMIT: tr('Invitation limit reached: 10 available at a time, 100 in total. Revoke an unused code if possible.', 'Limite de convites atingido: 10 disponíveis por vez, 100 no total. Revogue um código não utilizado, se possível.'),
          CONFLICT: tr('The record changed or this invitation was already used. Refresh and check the result.', 'O registro mudou ou este convite já foi utilizado. Atualize e confira o resultado.'),
        };
        if (response.status === 403 || response.status === 404 || response.status === 409) { busyRef.current = false; void refresh(); busyRef.current = true; }
        throw new Error(response.status >= 500 ? tr('The service is temporarily unavailable. Retry the same action after refreshing.', 'O serviço está temporariamente indisponível. Atualize e tente a mesma ação novamente.') : messages[result.code || ''] || tr('Could not complete this action. Refresh and retry.', 'Não foi possível concluir. Atualize e tente novamente.'));
      }
      apply(result); setSyncFailed(false); setLoaded(true); return result;
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && !['TypeError', 'TimeoutError', 'SyntaxError'].includes(e.name) ? e.message : tr('Connection interrupted. Refresh to check the result before retrying.', 'Conexão interrompida. Atualize para conferir o resultado antes de tentar novamente.'));
      return null;
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const body = { name: unitName.trim(), displayName: displayName.trim() };
    const key = JSON.stringify(body); if (createId.current?.key !== key) createId.current = { key, id: crypto.randomUUID() };
    const result = await perform({ action: 'create', requestId: createId.current.id, ...body });
    if (result) { createId.current = null; setSelectedId(result.ownedUnitId || ''); setNotice(tr('Test unit created. You can now invite your team.', 'Unidade de teste criada. Agora você pode convidar a equipe.')); requestAnimationFrame(() => unitPanel.current?.focus()); }
  }
  async function accept(event: React.FormEvent) {
    event.preventDefault(); const result = await perform({ action: 'accept', code: code.trim().toLowerCase(), displayName: joinName.trim() });
    if (result) { setCode(''); setNotice(tr('Membership confirmed. Your account is now linked to the unit.', 'Vínculo confirmado. Sua conta agora está ligada à unidade.')); const joined = result.units.find(u => !snapshot.units.some(old => old.id === u.id)); if (joined) setSelectedId(joined.id); requestAnimationFrame(() => unitPanel.current?.focus()); }
  }
  async function invite() {
    if (!unit) return;
    if (inviteRole === 'coach' && !window.confirm(tr('This code grants a coach access to the unit roster. Continue?', 'Este código dá ao coach acesso à lista de pessoas da unidade. Continuar?'))) return;
    const key = `${unit.id}:${inviteRole}`; if (inviteId.current?.key !== key) inviteId.current = { key, id: crypto.randomUUID() };
    const result = await perform({ action: 'invite', unitId: unit.id, role: inviteRole, requestId: inviteId.current.id });
    if (result) {
      inviteId.current = null; setCopied(false);
      if (result.inviteCode && result.invitation) { setSecret({ unitId: unit.id, code: result.inviteCode, invitation: result.invitation }); requestAnimationFrame(() => secretInput.current?.focus()); }
      else setNotice(tr('Invitation already saved, but its code cannot be recovered. Revoke it in the list and generate a new one.', 'O convite já foi salvo, mas o código não pode ser recuperado. Revogue-o na lista e gere outro.'));
    }
  }
  async function copyCode() {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret.code); setCopied(true); }
    catch { secretInput.current?.focus(); secretInput.current?.select(); setNotice(tr('Select and copy the code manually.', 'Selecione e copie o código manualmente.')); }
  }
  async function manage(action: string, id?: string, role?: string) {
    if (!unit) return;
    const prompt = action === 'leave' ? tr('Leave this unit? You will need a new invitation to return.', 'Sair desta unidade? Você precisará de outro convite para voltar.') : action === 'remove_member' ? tr('Remove this person’s access to the unit?', 'Remover o acesso desta pessoa à unidade?') : action === 'set_role' ? tr(`Change this person’s role to ${roleName(role || '')}?`, `Alterar o papel desta pessoa para ${roleName(role || '')}?`) : tr('Revoke this invitation? The code will stop working.', 'Revogar este convite? O código deixará de funcionar.');
    if (!window.confirm(prompt)) return;
    const result = await perform({ action, unitId: unit.id, ...(action === 'revoke_invite' ? { id } : action === 'remove_member' || action === 'set_role' ? { memberId: id } : {}), ...(role ? { role } : {}) });
    if (result) setNotice(tr('Access updated.', 'Acesso atualizado.'));
  }

  return <section className="inner-page class-page units-page">
    <div className="eyebrow">STRIKEX / {tr('UNIT & TEAM', 'UNIDADE E EQUIPE')}</div>
    <h1 className="page-title">{tr('A team. Connected.', 'Uma equipe. Conectada.')}<span>.</span></h1>
    <p className="page-subtitle">{tr('Link people to a test unit with their own accounts and clear roles.', 'Vincule pessoas a uma unidade de teste, cada uma com sua conta e seu papel.')}</p>
    <div className="units-toolbar"><button className="text-link" onClick={onAccount}><ArrowLeft size={15}/>{tr('My account', 'Minha conta')}</button><button className="text-link" onClick={onClasses}>{tr('My demo classes', 'Minhas turmas demo')}<ArrowUpRight size={15}/></button>{signedIn && !expired && <button className="text-link" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/>{tr('Refresh', 'Atualizar')}</button>}</div>
    {!ready ? <p className="saved-class-empty">{tr('Loading your account…', 'Carregando sua conta…')}</p> : !signedIn || expired ? <article className="unit-signin"><div className="unit-symbol"><KeyRound size={34}/></div><h2>{tr('Your account is your access.', 'Sua conta é seu acesso.')}</h2><p>{tr('Sign in to create a test unit or accept an invitation. Guest profiles cannot manage team access.', 'Entre para criar uma unidade de teste ou aceitar um convite. Perfis de visitante não gerenciam acessos da equipe.')}</p><a className="btn btn-primary" href={SIGN_IN} target="_top">{tr('Sign in with ChatGPT', 'Entrar com ChatGPT')}<ArrowUpRight size={17}/></a></article> : <>
      <p className="planner-disclosure"><ShieldCheck size={16}/>{tr('This area manages team membership. Demo classes and receipts remain private to their creators until shared classes are integrated.', 'Esta área gerencia os vínculos da equipe. Turmas e comprovantes demo continuam privados de quem os criou até a integração das aulas compartilhadas.')}</p>
      {syncFailed && <div className="planner-error" role="alert">{tr('Could not sync access. Your form is preserved; refresh before changing permissions.', 'Não foi possível sincronizar os acessos. Seu formulário foi preservado; atualize antes de alterar permissões.')}</div>}
      {error && <div className="planner-error" ref={errorPanel} tabIndex={-1} role="alert">{error}</div>}
      {notice && <p className="planner-notice" role="status"><Check size={17}/>{notice}</p>}
      {!loaded ? <p className="saved-class-empty">{tr('Loading your units…', 'Carregando suas unidades…')}</p> : <>
        {snapshot.units.length > 0 && <div className="unit-picker"><label htmlFor="unit-selection">{tr('Your units', 'Suas unidades')}</label><select id="unit-selection" value={selectedId} disabled={busy} onChange={e => { setSelectedId(e.target.value); setSecret(null); setNotice(''); }} aria-label={tr('Select unit', 'Selecionar unidade')}>{snapshot.units.map(u => <option key={u.id} value={u.id}>{u.name} · {roleName(u.myRole)}</option>)}</select></div>}
        {unit && <section className="unit-panel" ref={unitPanel} tabIndex={-1} aria-label={tr('Selected unit', 'Unidade selecionada')}>
          <div className="unit-header"><div className="unit-symbol"><Building2 size={28}/></div><div><span className="tiny-label">{tr('TEST UNIT', 'UNIDADE DE TESTE')}</span><h2>{unit.name}</h2><p>{tr('Your role', 'Seu papel')}: <strong>{roleName(unit.myRole)}</strong> · {unit.memberCount}/50 {tr('people', 'pessoas')}</p></div>{unit.myRole !== 'owner' && <button className="text-link unit-leave" disabled={disabled} onClick={() => void manage('leave')}><LogOut size={15}/>{tr('Leave unit', 'Sair da unidade')}</button>}</div>
          <div className="unit-permission"><ShieldCheck size={18}/><p>{unit.myRole === 'owner' ? tr('You manage invitations and roles in this test unit. Ownership cannot be transferred here.', 'Você gerencia convites e papéis nesta unidade de teste. A gestão não pode ser transferida por aqui.') : unit.myRole === 'coach' ? tr('You can consult the roster. Invitations, role changes and removals belong to the manager.', 'Você pode consultar a equipe. Convites, alterações de papel e remoções cabem ao gestor.') : tr('Your membership is linked to your signed-in account. Only your own registration is shown here.', 'Seu vínculo está ligado à conta conectada. Aqui você vê somente o seu cadastro.')}</p></div>
          <div className="unit-roster-heading"><h3>{unit.myRole === 'athlete' ? tr('Your membership', 'Seu vínculo') : tr('People in the unit', 'Pessoas da unidade')}</h3><span className="tiny-label">{tr('ACCOUNT-LINKED', 'VINCULADOS À CONTA')}</span></div>
          <div className="unit-members">{unit.members.map(member => <article className="unit-member" key={member.id}><div className="unit-avatar">{member.name.slice(0, 1).toUpperCase()}</div><div className="unit-member-name"><strong>{member.name}{member.isSelf && <small>{tr('you', 'você')}</small>}</strong><span>{tr('Joined', 'Entrada')}: {new Date(member.joinedAt).toLocaleDateString(pt ? 'pt-PT' : 'en-GB')}</span></div>{unit.myRole === 'owner' && member.role !== 'owner' ? <div className="unit-member-actions"><select value={member.role} disabled={disabled} aria-label={`${tr('Role', 'Papel')}: ${member.name}`} onChange={e => void manage('set_role', member.id, e.target.value)}><option value="coach">Coach</option><option value="athlete">{tr('Athlete', 'Atleta')}</option></select><button className="unit-remove" disabled={disabled} onClick={() => void manage('remove_member', member.id)} aria-label={`${tr('Remove access', 'Remover acesso')}: ${member.name}`} title={tr('Remove access', 'Remover acesso')}><UserMinus size={17}/></button></div> : <span className={`unit-role role-${member.role}`}>{roleName(member.role)}</span>}</article>)}</div>
          {unit.myRole === 'owner' && <section className="unit-invites"><div className="report-heading"><div><span className="tiny-label">{tr('ONE PERSON / ONE CODE', 'UMA PESSOA / UM CÓDIGO')}</span><h2>{tr('Bring your team.', 'Traga sua equipe.')}</h2></div><Users size={26}/></div><p className="report-intro">{tr('Each code can be accepted once and expires in seven days. Share it only with the intended person; it grants the selected role.', 'Cada código pode ser aceito uma vez e expira em sete dias. Compartilhe apenas com a pessoa escolhida: ele concede o papel selecionado.')}</p><div className="unit-invite-create"><label>{tr('Invitation role', 'Papel do convite')}<select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'coach' | 'athlete')} disabled={disabled || !!secret}><option value="athlete">{tr('Athlete', 'Atleta')}</option><option value="coach">Coach</option></select></label><button className="btn btn-primary" disabled={disabled || !!secret || (unit.invitations?.filter(i => i.status === 'pending').length || 0) >= 10} onClick={() => void invite()}><Plus size={17}/>{tr('Generate invitation', 'Gerar convite')}</button></div>
            {secret?.unitId === unit.id && <div className="unit-code-card" role="region" aria-label={tr('New invitation code', 'Código do novo convite')}><span className="tiny-label">{roleName(secret.invitation.role)} · {tr('COPY BEFORE LEAVING', 'COPIE ANTES DE SAIR')}</span><label htmlFor="new-invite-code">{tr('Invitation code', 'Código do convite')}</label><div><input id="new-invite-code" ref={secretInput} value={secret.code} readOnly onFocus={e => e.target.select()} spellCheck={false}/><button className="btn btn-subtle" onClick={() => void copyCode()}>{copied ? <Check size={17}/> : <Copy size={17}/>}<span>{copied ? tr('Copied', 'Copiado') : tr('Copy', 'Copiar')}</span></button></div><p>{tr('Shown only now. Send the code yourself and ask the person to open Unit & Team and accept it with their account.', 'Exibido somente agora. Envie o código e peça à pessoa para abrir Unidade e equipe e aceitá-lo com a própria conta.')}</p><button className="text-link" onClick={() => setSecret(null)}>{tr('I saved the code', 'Já guardei o código')}<X size={14}/></button></div>}
            <div className="unit-invitation-list">{unit.invitations?.length ? unit.invitations.map(invitation => <div key={invitation.id} className="unit-invitation"><div><strong>{roleName(invitation.role)}</strong><small>{tr('Expires', 'Expira')}: {new Date(invitation.expiresAt).toLocaleString(pt ? 'pt-PT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · #{invitation.id.slice(0, 8)}</small></div><span className={`invite-state invite-${invitation.status}`}>{inviteStatus(invitation.status)}</span>{invitation.status === 'pending' && <button className="text-link" disabled={disabled} onClick={() => void manage('revoke_invite', invitation.id)}>{tr('Revoke', 'Revogar')}</button>}</div>) : <p className="saved-class-empty">{tr('No invitations yet.', 'Nenhum convite ainda.')}</p>}</div><p className="report-draft-note">{tr('Up to 10 available codes and 100 invitations in this test unit. Lost code? Revoke it and generate another.', 'Até 10 códigos disponíveis e 100 convites nesta unidade de teste. Perdeu um código? Revogue-o e gere outro.')}</p>
          </section>}
        </section>}
        <div className={`unit-entry-grid ${snapshot.ownedUnitId ? 'single' : ''}`}>{!snapshot.ownedUnitId && <form className="unit-entry-card" onSubmit={event => void create(event)}><Building2 size={27}/><span className="tiny-label">{tr('MANAGE YOUR TEST UNIT', 'GERENCIE SUA UNIDADE DE TESTE')}</span><h2>{tr('Create a unit.', 'Crie uma unidade.')}</h2><p>{tr('One test unit per manager. This does not register or certify an official StrikeX location.', 'Uma unidade de teste por gestor. Isso não cadastra nem certifica uma unidade oficial StrikeX.')}</p><label>{tr('Unit name', 'Nome da unidade')}<input value={unitName} onChange={e => setUnitName(e.target.value)} maxLength={80} required disabled={busy}/></label><label>{tr('Your name in this unit', 'Seu nome nesta unidade')}<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60} required disabled={busy} autoComplete="name"/></label><button className="btn btn-primary" disabled={disabled || !unitName.trim() || !displayName.trim()} type="submit"><Plus size={17}/>{tr('Create test unit', 'Criar unidade de teste')}</button></form>}
          <form className="unit-entry-card" onSubmit={event => void accept(event)}><KeyRound size={27}/><span className="tiny-label">{tr('RECEIVED AN INVITATION?', 'RECEBEU UM CONVITE?')}</span><h2>{tr('Join your team.', 'Entre para a equipe.')}</h2><p>{tr('Use the code from the manager. Your name will be visible to the manager and coaches of that unit.', 'Use o código do gestor. Seu nome ficará visível para o gestor e os coaches dessa unidade.')}</p><label>{tr('Invitation code', 'Código do convite')}<input value={code} onChange={e => setCode(e.target.value)} maxLength={40} required disabled={busy} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder={tr('32 characters', '32 caracteres')}/></label><label>{tr('Your name in this unit', 'Seu nome nesta unidade')}<input value={joinName} onChange={e => setJoinName(e.target.value)} maxLength={60} required disabled={busy} autoComplete="name"/></label><button className="btn btn-primary" disabled={disabled || !/^[a-fA-F0-9]{32}$/.test(code.trim()) || !joinName.trim()} type="submit"><ArrowUpRight size={17}/>{tr('Accept invitation', 'Aceitar convite')}</button></form>
        </div>
      </>}
    </>}
  </section>;
}

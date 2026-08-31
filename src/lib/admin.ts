/**
 * Mantido como wrapper fino de compatibilidade — a lógica real agora vive
 * em `./member.ts` (Caixa 0: login por pessoa). `getAdminUser()` continua
 * com o shape antigo `{ email, source }` pros ~20 call-sites existentes
 * migrarem gradualmente pra `getCurrentMember()`/`requireMember()`.
 */
export { getAdminUserCompat as getAdminUser } from "./member";

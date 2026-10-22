import { ApiError } from "@/api/errors";
import { memoryStorage } from "@/auth/secure-storage";
import { needsRefresh, readAdminSession, validAdminSession, writeAdminSession, type AdminSession } from "./admin-session";

const NOW = Date.parse("2026-10-22T10:00:00Z");
const session = (expiresAt: string, accessToken = "jwt-1"): AdminSession => ({ accessToken, refreshToken: "refresh-1", expiresAt, clubId: "club-a-id", email: "admin@example.test" });

describe("session d'administration (compte club_admin)", () => {
  it("gardée par club ; données illisibles = pas de session", async () => {
    const storage = memoryStorage({ "bm.admin.club-b": "{pas du json" });
    await writeAdminSession(storage, "club-a", session("2026-10-22T11:00:00Z"));
    expect(await readAdminSession(storage, "club-a")).toMatchObject({ clubId: "club-a-id" });
    expect(await readAdminSession(storage, "club-b")).toBeNull();
  });

  it("rafraîchie seulement à moins de 2 min de l'expiration", async () => {
    expect(needsRefresh(session("2026-10-22T10:30:00Z"), NOW)).toBe(false);
    expect(needsRefresh(session("2026-10-22T10:01:00Z"), NOW)).toBe(true);
    const storage = memoryStorage();
    await writeAdminSession(storage, "club-a", session("2026-10-22T10:01:00Z"));
    const refresh = jest.fn(async () => session("2026-10-22T11:01:00Z", "jwt-2"));
    expect((await validAdminSession(storage, "club-a", refresh, NOW))?.accessToken).toBe("jwt-2");
    expect((await readAdminSession(storage, "club-a"))?.accessToken).toBe("jwt-2");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rafraîchissement refusé (rôle retiré, session expirée) : session effacée ; coupure réseau : gardée", async () => {
    const storage = memoryStorage();
    await writeAdminSession(storage, "club-a", session("2026-10-22T09:00:00Z"));
    await expect(validAdminSession(storage, "club-a", async () => Promise.reject(new ApiError("offline", "Pas de connexion", 0)), NOW)).rejects.toThrow("Pas de connexion");
    expect(await readAdminSession(storage, "club-a")).not.toBeNull();
    expect(await validAdminSession(storage, "club-a", async () => Promise.reject(new ApiError("forbidden", "Ce compte n'est pas administrateur de ce club.", 403)), NOW)).toBeNull();
    expect(await readAdminSession(storage, "club-a")).toBeNull();
  });
});

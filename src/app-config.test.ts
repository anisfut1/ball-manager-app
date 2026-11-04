import type { ConfigContext } from "expo/config";
import appConfig from "../app.config";

/**
 * Garde-fou de configuration native (A3, audit sécurité 2026-11) : les réglages
 * qui ne se voient qu'au build doivent être testables sans build.
 */
const config = appConfig({ config: {} } as ConfigContext);

describe("app.config — Android", () => {
  it("désactive la sauvegarde automatique des données (allowBackup: false)", () => {
    expect(config.android?.allowBackup).toBe(false);
  });

  it("garde l'identifiant de paquet attendu", () => {
    expect(config.android?.package).toBe("fr.ballmanager.app");
  });
});

describe("app.config — iOS", () => {
  it("garde le Bundle ID et le Team ID enregistrés chez Apple", () => {
    expect(config.ios?.bundleIdentifier).toBe("fr.ballmanager.app");
    expect(config.ios?.appleTeamId).toBe("YFZ72KY47V");
  });

  it("n'utilise que le chiffrement exempté", () => {
    expect(config.ios?.config?.usesNonExemptEncryption).toBe(false);
  });
});

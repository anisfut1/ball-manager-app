import createClient from "openapi-fetch";
import type { paths } from "../generated/schema";
import { setApiClientForTests } from "../client";
import { setCredentialSource } from "../credentials";
import { authApi } from "./auth";

// Données fictives uniquement : le réseau est simulé, la vraie route n'est jamais appelée.
const SECRET = "bmd_sentinelle_suppression";

function install(respond: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetchMock = async (input: Request) => {
    requests.push(input);
    return respond(input);
  };
  setApiClientForTests(createClient<paths>({ baseUrl: "https://api.test", fetch: fetchMock as typeof fetch }));
  return requests;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  setApiClientForTests(null);
  setCredentialSource(null);
});

describe("authApi.deleteAccount", () => {
  it("envoie DELETE sur /auth/me du club, avec le Bearer de la session", async () => {
    const requests = install(() => new Response(null, { status: 204 }));
    await authApi.deleteAccount("club-demo", SECRET);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe("DELETE");
    expect(requests[0]!.url).toBe("https://api.test/v1/public/clubs/club-demo/auth/me");
    expect(requests[0]!.headers.get("authorization")).toBe(`Bearer ${SECRET}`);
  });

  it("204 → deleted", async () => {
    install(() => new Response(null, { status: 204 }));
    await expect(authApi.deleteAccount("club-demo", SECRET)).resolves.toEqual({ kind: "deleted" });
  });

  it("401 → session_invalid, sans déclencher le flux global de session invalide", async () => {
    const onSessionInvalid = jest.fn();
    setCredentialSource({ secretFor: () => SECRET, onSessionInvalid });
    install(() => json(401, { error: { code: "SESSION_INVALID", message: "Session invalide" } }));
    await expect(authApi.deleteAccount("club-demo", SECRET)).resolves.toEqual({ kind: "session_invalid" });
    expect(onSessionInvalid).not.toHaveBeenCalled();
  });

  it("5xx → failed (message humain, jamais le détail serveur)", async () => {
    install(() => json(500, { error: { code: "INTERNAL", message: "détail technique" } }));
    const result = await authApi.deleteAccount("club-demo", SECRET);
    expect(result).toMatchObject({ kind: "failed", error: { kind: "server", status: 500 } });
  });

  it("erreur réseau → failed (offline)", async () => {
    install(() => {
      throw new TypeError("Network request failed");
    });
    const result = await authApi.deleteAccount("club-demo", SECRET);
    expect(result).toMatchObject({ kind: "failed", error: { kind: "offline" } });
  });
});

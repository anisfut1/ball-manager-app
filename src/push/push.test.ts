import { toApnsEnvironment } from "./apns-environment";
import { notificationPath } from "./notification-path";
import { registrationKey } from "./registration";

const note = (trigger: unknown, data: Record<string, unknown> | null = null) => ({ request: { content: { data }, trigger } });

describe("destination d'une notification", () => {
  it("payload APNs brut du backend (`path` au premier niveau) — lu dans trigger.payload", () => {
    expect(notificationPath(note({ type: "push", payload: { aps: { alert: { title: "t" } }, path: "/public/sc-sete/matchs/m1#convocation" } }))).toBe("/public/sc-sete/matchs/m1#convocation");
  });
  it("replis : content.data.path, puis payload.body.path (convention Expo)", () => {
    expect(notificationPath(note({ type: "push" }, { path: "/public/a/accueil" }))).toBe("/public/a/accueil");
    expect(notificationPath(note({ type: "push", payload: { body: { path: "/public/a/derogations/r1" } } }))).toBe("/public/a/derogations/r1");
  });
  it("jamais une destination hors de l'espace public ou absurde", () => {
    expect(notificationPath(note({ type: "push", payload: { path: "https://evil.example" } }))).toBeNull();
    expect(notificationPath(note({ type: "push", payload: { path: 42 } }))).toBeNull();
    expect(notificationPath(note(null))).toBeNull();
  });
});

describe("environnement APNs", () => {
  it("seules les valeurs Apple sont acceptées ; simulateur (null) → pas d'enregistrement", () => {
    expect(toApnsEnvironment("production")).toBe("production");
    expect(toApnsEnvironment("development")).toBe("development");
    expect(toApnsEnvironment(null)).toBeNull();
    expect(toApnsEnvironment("sandbox")).toBeNull();
  });
  it("même jeton dans un autre environnement = nouvel enregistrement (TestFlight après une build Xcode)", () => {
    expect(registrationKey("abc", "development")).not.toBe(registrationKey("abc", "production"));
  });
});

export const rawAppVersion =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

export const formatAppVersion = (version: string | undefined) => {
  if (!version || version === "dev") {
    return version ?? "dev";
  }

  return version.replace(/^v/i, "").split("-")[0] ?? version;
};

export const appDisplayVersion = formatAppVersion(rawAppVersion);

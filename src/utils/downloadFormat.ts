import type { DownloadItem } from "../types/launcher";

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const formatDownloadSpeed = (bytesPerSecond: number) =>
  `${formatBytes(bytesPerSecond)}/s`;

export const getDownloadEtaSeconds = (item: DownloadItem) => {
  if (
    item.status !== "running" ||
    !item.totalBytes ||
    item.speedBytesPerSecond <= 0 ||
    item.bytesReceived >= item.totalBytes
  ) {
    return null;
  }

  return Math.ceil((item.totalBytes - item.bytesReceived) / item.speedBytesPerSecond);
};

export const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "agora";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}min ${remainingSeconds}s` : `${minutes}min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
};

export const formatDownloadSize = (item: DownloadItem) =>
  item.totalBytes
    ? `${formatBytes(item.bytesReceived)} / ${formatBytes(item.totalBytes)}`
    : formatBytes(item.bytesReceived);

export const formatDownloadEta = (item: DownloadItem) => {
  const eta = getDownloadEtaSeconds(item);
  return eta === null ? "estimando..." : formatDuration(eta);
};

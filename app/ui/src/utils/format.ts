export function formatDate(date: string | null): string {
  if (!date) {
    return "—";
  }
  return new Date(date).toLocaleString("ru-RU");
}

export function humanSize(size: number): string {
  if (size < 1024) {
    return `${size} Б`;
  }
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

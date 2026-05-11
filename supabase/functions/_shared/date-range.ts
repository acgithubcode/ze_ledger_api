export const startOfDay = (value: Date | string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const endOfDay = (value: Date | string) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

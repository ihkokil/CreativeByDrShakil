function getActiveDbIndex() {
  const now = new Date();
  const gmt6Time = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  const dbTime = new Date(gmt6Time.getTime() - (4 * 60 * 60 * 1000));
  const day = dbTime.getUTCDate();
  const rem = day % 5;
  return rem === 0 ? 4 : rem - 1;
}
console.log('Active DB Index:', getActiveDbIndex() + 1);

// Test weekOfMonth calculation
function weekOfMonth(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return 0;
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const dayOfWeek = firstDay.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const day = d.getDate();
  // Calculate which week this date falls into (1-based)
  // Week 1 starts on the first day of the month
  return Math.ceil((day + dayOfWeek) / 7);
}

console.log("Testing weekOfMonth calculation for January 2026:\n");
console.log("Date \t | Day of Week | Week Number");
console.log("--------|-------------|------------");

const tests = [1, 4, 11, 18, 25, 28, 29, 31];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

tests.forEach(date => {
  const d = new Date(2026, 0, date);
  const dayOfWeek = d.getDay();
  const dayName = dayNames[dayOfWeek];
  const weekNum = weekOfMonth(`2026-01-${String(date).padStart(2, '0')}`);
  console.log(`Jan ${String(date).padStart(2, '0')} | ${dayName} (${dayOfWeek}) | Week ${weekNum}`);
});

console.log("\nExpected:");
console.log("- Jan 1-3:   Week 1");
console.log("- Jan 4-10:  Week 2");
console.log("- Jan 11-17: Week 3");
console.log("- Jan 18-24: Week 4");
console.log("- Jan 25-31: Week 5");

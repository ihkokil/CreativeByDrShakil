export interface Module {
  id: string;
  title: string;
  [key: string]: any;
}

export interface ScheduledModule extends Module {
  releaseAt: string; // ISO date string (YYYY-MM-DD or full ISO string)
}

export interface StudentModuleView {
  modules: ScheduledModule[];
}

/**
 * Standardizes a date's time to 12:00:00.000 (noon) to avoid timezone-related date shifts.
 */
function normalizeDateToNoon(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Snaps a date to the previous Friday. If the date is already a Friday, returns the date.
 */
export function getPreviousFriday(date: Date): Date {
  const d = normalizeDateToNoon(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const diff = (day - 5 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * Generates the weekly schedule for a sequence of modules.
 * The first module is scheduled on the previous/current Friday of the baseDate.
 * Each subsequent module is scheduled +7 days from the last one.
 */
export function generateModuleSchedule(modules: Module[], baseDate: Date): ScheduledModule[] {
  const startFriday = getPreviousFriday(baseDate);
  return modules.map((mod, index) => {
    const d = new Date(startFriday.getTime());
    d.setDate(d.getDate() + index * 7);
    
    // Format as YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const releaseAt = `${yyyy}-${mm}-${dd}`;

    return {
      ...mod,
      releaseAt,
    };
  });
}

/**
 * Sorts modules chronologically based on their availability/release date.
 */
export function getStudentModuleView(
  schedule: ScheduledModule[],
  enrollmentDate: Date,
  today: Date
): StudentModuleView {
  const sorted = [...schedule].sort((a, b) => {
    const dateA = new Date(a.releaseAt || 0).getTime();
    const dateB = new Date(b.releaseAt || 0).getTime();
    return dateA - dateB;
  });

  return {
    modules: sorted,
  };
}

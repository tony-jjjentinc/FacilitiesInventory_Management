/**
 * @file projectGuard.ts
 * @description An MRL belongs to one project (its MRQ classification). Charging it to an activity of another project is
 * refused by the server unless a Head or Super Admin approves it with a written reason (see assertProjectMatch in
 * api/ReceivingService.gs). These helpers let the screens say so before the request is sent.
 */
/** Same project, or one side has no classification yet (older data is never blocked). */
export const sameProject = (a?: string, b?: string): boolean => !a?.trim() || !b?.trim() || a.trim().toLowerCase() === b.trim().toLowerCase();

/** The sentence shown next to an activity of another project. */
export const mismatchText = (mrl: string, activity: string): string =>
  `This MRL is for project ${mrl}, but this activity is ${activity}. The materials would be charged to the wrong project.`;

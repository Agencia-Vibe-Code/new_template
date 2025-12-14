export type SubmissionLike = {
  createdAt: string | Date;
};

export function orderSubmissionsLatestFirst<T extends SubmissionLike>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getGradeClass(grade: string): string {
  if (grade === "A+") return "excellent";
  if (grade === "A") return "great";
  if (grade === "B") return "good";
  if (grade === "C") return "fair";
  if (grade === "D") return "poor";
  if (grade === "F") return "bad";
  return "empty";
}

export function getGradeLabel(grade: string): string {
  if (grade === "A+") return "Excellent";
  if (grade === "A") return "Very Good";
  if (grade === "B") return "Good";
  if (grade === "C") return "Fair";
  if (grade === "D") return "Poor";
  return "Very Poor";
}

export function getHealthGradeClass(grade: string): "good" | "warn" | "bad" {
  if (grade === "A+" || grade === "A" || grade === "B") return "good";
  if (grade === "C" || grade === "D") return "warn";
  return "bad";
}
// Educational questionnaire scoring; not a diagnosis or a substitute for clinical review.
export function stopBangScore(answers) {
  return ['s', 't', 'o', 'p', 'b', 'a', 'n', 'g'].filter((key) => answers[key] === true).length;
}

export function stopBangRisk(answers) {
  const score = stopBangScore(answers);
  const firstFour = ['s', 't', 'o', 'p'].filter((key) => answers[key] === true).length;
  if (score >= 5 || (firstFour >= 2 && (answers.g || answers.b || answers.n))) return 'HIGH';
  return score >= 3 ? 'INTERMEDIATE' : 'LOW';
}

export function epworthScore(answers) {
  if (!Array.isArray(answers) || answers.length !== 8 || answers.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) return null;
  return answers.reduce((sum, value) => sum + value, 0);
}

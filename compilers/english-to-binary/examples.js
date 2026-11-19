const EXAMPLES = {
  "Factorial": {
    tests: [[[0],1],[[5],120],[[10],3628800]],
    text: `Given n.
Let result be 1.
While n is greater than 1:
  Multiply result by n.
  Decrease n by 1.
End.
Return result.`},
  "Fibonacci": {
    tests: [[[0],0],[[1],1],[[10],55],[[30],832040]],
    text: `Given n.
Let a be 0.
Let b be 1.
Repeat while n is greater than 0:
  Let t be a plus b.
  Set a to b.
  Set b to t.
  Decrease n by 1.
End.
Return a.`},
  "Greatest common divisor": {
    tests: [[[12,18],6],[[17,5],1],[[48,180],12]],
    text: `Given a and b.
While b is not 0:
  Let t be a mod b.
  Set a to b.
  Set b to t.
End.
Return a.`},
  "Is it prime?": {
    tests: [[[1],0],[[2],1],[[21],0],[[97],1]],
    text: `Given n.
If n is less than 2, return 0.
Let i be 2.
While i times i is at most n:
  If n is divisible by i, return 0.
  Add 1 to i.
End.
Return 1.`},
  "Bigger of two": {
    tests: [[[3,9],9],[[9,3],9],[[-2,-7],-2]],
    text: `Given a and b.
If a is greater than b, return a.
Return b.`},
  "Sum from 1 to n": {
    tests: [[[10],55],[[1000],500500]],
    text: `Given n.
Return n times (n plus 1) divided by two.`},
  "Grade a score": {
    tests: [[[95],1],[[75],2],[[55],3],[[20],4]],
    text: `# 1 = A, 2 = B, 3 = C, 4 = fail
Given score.
If score is at least 90, return 1.
If score is at least 70, return 2.
If score is at least 50:
  Return 3.
Otherwise:
  Return 4.
End.`}
};
if (typeof module !== 'undefined') module.exports = { EXAMPLES };

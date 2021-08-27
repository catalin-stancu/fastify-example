/**
 * check if nr is prime
 *
 * @param {*} num num
 * @return {boolean}
 */
function isPrime(num) {
  for (let i = 2; i < num; i += 1) if (num % i === 0) return false;
  return num > 1;
}

/**
 * get primes between a and b inclusive
 *
 * @export
 * @param {*} a lower limit
 * @param {*} b upper limit
 * @returns {Array<number>}
 */
export function getPrimesBetween({ a, b }) {
  const results = [];
  for (let i = a; i <= b; i += 1) {
    if (isPrime(i)) results.push(i);
  }

  return results;
}
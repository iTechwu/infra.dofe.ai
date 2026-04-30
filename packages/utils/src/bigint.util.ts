export default {
  add(num1: bigint | number, num2: bigint | number): bigint {
    const add1 = typeof num1 === 'bigint' ? parseInt(`${num1}`) : num1;
    const add2 = typeof num2 === 'bigint' ? parseInt(`${num2}`) : num2;
    return BigInt(add1 + add2);
  },

  des(num1: bigint | number, num2: bigint | number): bigint {
    const des1 = typeof num1 === 'bigint' ? parseInt(`${num1}`) : num1;
    const des2 = typeof num2 === 'bigint' ? parseInt(`${num2}`) : num2;
    return BigInt(des1 - des2);
  },

  parseToInt(num: bigint): number {
    return parseInt(`${num}`);
  },

  gt(num1: bigint | number, num2: bigint | number): boolean {
    const gt1 = typeof num1 === 'bigint' ? parseInt(`${num1}`) : num1;
    const gt2 = typeof num2 === 'bigint' ? parseInt(`${num2}`) : num2;
    return gt1 > gt2;
  },

  serialize(obj: any, seen = new WeakSet()): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'object' && seen.has(obj)) {
      return '[Circular]';
    }

    switch (typeof obj) {
      case 'bigint':
        return this.parseToInt(obj);
      case 'object':
        if (obj instanceof Date) {
          return obj;
        }
        if (Array.isArray(obj)) {
          seen.add(obj);
          const result = obj.map((value) => this.serialize(value, seen));
          seen.delete(obj);
          return result;
        }
        seen.add(obj);
        const result = Object.fromEntries(
          Object.entries(obj).map(([key, value]) => [
            key,
            this.serialize(value, seen),
          ]),
        );
        seen.delete(obj);
        return result;
      default:
        return obj;
    }
  },
};

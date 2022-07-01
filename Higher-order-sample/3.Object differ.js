let o1 = {
  one: 1,
  two: 2,
  three: 3,
};

let o2 = {
  two: 2,
  three: 3,
  four: 4,
};

let diff = Object.keys(o2).reduce((diff, key) => {
  if (o1[key] === o2[key]) return diff;
  return {
    ...diff,
    [key]: o2[key],
  };
}, {});

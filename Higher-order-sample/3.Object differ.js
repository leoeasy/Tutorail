let o1 = {
  one: 1,
  two: 2,
  three: 3,
};

let o2 = {
  one: 7,
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
// {one: 7, four: 4}

//solution1
Object.entries(o1).map((z) => {
  let obj = { [z[0]]: z[1] };
  return obj;
});

/**[
  {
      "one": 1
  },
  {
      "two": 2
  },
  {
      "three": 3
  }
]
*/

//solution2
Object.keys(o1).map((k) => ({ [k]: o1[k] }));

/**[
  {
      "one": 1
  },
  {
      "two": 2
  },
  {
      "three": 3
  }
]
*/

// solution 3
Object.entries(o1).map((prop) => {
  const mp = new Map([prop]);
  return Object.fromEntries(mp);
});
/**[
    {
        "one": 1
    },
    {
        "two": 2
    },
    {
        "three": 3
    }
] */

/**
 * Q :Destructerue 'properties' with alias 'elementprops', then grab X and Y related value as a number type:
 */

const { properties: elementProps } = scProps;
const coordinate = elementProps
  .filter((prop) => {
    const { label } = prop;
    return label === "X" || label === "Y";
  })
  .map((prop) => +[prop.value.match(/-?\d+.?\d*/)]);
const [x, y] = coordinate;

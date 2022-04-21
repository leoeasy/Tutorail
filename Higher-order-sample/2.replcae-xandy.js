/**
 * Q2: Find X, Y related value in the object and Replace it with given array x, y:
 *
 */
const modifiedProps = elementProps.map((v) => {
  if (v.label === "X") {
    v.value = `${+releasedElementProps[0]} mm`;
    return v;
  } else if (v.label === "Y") {
    v.value = `${+releasedElementProps[1]} mm`;
    return v;
  } else {
    return v;
  }
});

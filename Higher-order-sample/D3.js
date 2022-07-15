/**
 *The  'D3ren' component, renders and represents relevant panel and element properties taken from the server, as well as managing interaction with the graphic.
 */

// Built-in
import React, { useEffect, useContext, useRef } from 'react';

// External
import * as d3 from 'd3';

// Internal
import AppContext, { d3vars } from '../context/AppContext';
let {
  svgElement, // Holds the 'SVG' graphic data which already have been grabbed by D3.
  frontPanel, // Holds the svg inside group element data.
  selectedElementIds, // The array that contains the selected elements' ids.
  isSelectionChanged, //The flag which is indicate that element swap status
  isDragged, // The flag which is used for check element moved.
  prevPosition, //The object which is used for setting initial x and y data of the slected element
  prevDragPosition, //The object is used for catching the previous position of the element   while it's dragging throughout the canvas area
} = d3vars;
const D3ren = () => {
  const context = useContext(AppContext);

  //the variables which need to be persisted between component rendering, declare as an 'useRef' object properties
  const svgFpRef = useRef();
  const isDataReceived = useRef('false');
  const isDropDataReceived = useRef('false');
  const currentTransform = useRef();

  const { meshData, elementIds, isElementModified, scVersion } = context.data;
  /*
   * initial side effect which is responsible for render SVG graphic and initialize D3 functionalitis.
   * Triggered once mesh data is received.
   */

  useEffect(() => {
    svgFpRef.current.innerHTML = meshData;
    const zoom = d3.zoom(); //Creates a new zoom behavior. The returned behavior, zoom, is both an object and a function, and is typically applied to selected elements via selection.call.
    const [innerSvg] = svgFpRef.current.getElementsByTagName('svg');
    const [innerGroup] = svgFpRef.current.getElementsByTagName('g');
    svgElement = d3.select(innerSvg);
    frontPanel = d3.select(innerGroup);

    /**
     * appends group element to the svg file in order to preparation of adding elements of multiselection
     */
    const viewPortDim = document // get viewport dimension of the SVG graphic
      .getElementById('svg-ld')
      .getBoundingClientRect();
    svgElement // set dimentions of the SVG graphic based on viewport
      .attr('width', viewPortDim.width)
      .attr('height', viewPortDim.height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .call(
        d3
          .drag()
          .on('start', canvasClickHandler)
          .on('drag', CanvasDragHandler)
          .on('end', elementReleaseHandler)
      );
    /**
     * Sets the 'initial transformation attributes' so the margin is implemented the first time the panel is loaded.
     */
    if (currentTransform.current && isElementModified) {
      frontPanel.attr('transform', currentTransform.current);
    } else {
      const { width, height } = frontPanel.node().getBBox();
      const frontPanelTransform = frontPanel
        .node()
        .transform.baseVal.consolidate().matrix;

      frontPanelTransform.a = 0.93;
      frontPanelTransform.d = -0.93;
      frontPanelTransform.e = 0.039 * width;
      frontPanelTransform.f -= 0.039 * height;
    }

    /**
     * Removes each group that does not have 'fpd.id' attribute.
     */
    frontPanel.selectAll('g').each(function () {
      if (!this.hasAttribute('fpd.id')) {
        this.remove();
      }
    });

    /**
     * Grabs the 'stroke-width' value from elements and add it to the associated parent group
     */

    frontPanel.selectAll('g > path, image').each(function () {
      d3.select(this.parentNode).attr(
        'stroke-width',
        d3.select(this).attr('stroke-width') || 0
      );
      if (!this.hasAttribute('transform')) {
        d3.select(this).attr('transform', 'translate(0,0)');
      }
    });

    // append empty path in order to be a place for range-selection-box

    frontPanel
      .append('path')
      .attr('id', 'selectionBox')
      .attr('d', null)
      .attr('fill-opacity', '.2')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 5')
      .attr('vector-effect', 'non-scaling-stroke');

    /**
     * Sets the 'panelClickHandler' event, to the panel element
     */
    frontPanel
      .selectAll('g')
      .filter(function () {
        return d3.select(this).attr('fpd.panel');
      })
      .attr('class', 'panel')

      .call(
        d3
          .drag()
          .on('start', panelClickHandler)
          .on('drag', elementDragHandler)
          .on('end', elementReleaseHandler)
      );

    /**
     * Sets the 'elementClickHandler' event, to the SVG elements.(all groups except panel)
     */
    frontPanel
      .selectAll('g')
      .filter(function () {
        return !this.hasAttribute('fpd.panel');
      })
      .call(
        d3
          .drag()
          .on('start', elementClickHandler)
          .on('drag', elementDragHandler)
          .on('end', elementReleaseHandler)
      );

    svgElement.call(
      zoom //invoke d3.zoom() function
        .extent([
          // sets the viewport extent to the specified array of points [[x0, y0], [x1, y1]],
          [0, 0], // [x0, y0] is the top-left corner of the viewport
          [viewPortDim.width, viewPortDim.height], //and [x1, y1]- is the bottom-right corner of the viewport, and returns this zoom behavior.
        ])
        .scaleExtent([0.5, 10]) //sets the scale extent to the specified array of numbers [k0, k1] where k0 is the minimum allowed scale factor and k1 is the maximum allowed scale factor, and returns this zoom behavior
        .on('zoom', zoomHandler)
        //responsible for clicking the middle mouse button in order to handle the panning feature.
        .filter(function (event) {
          return event.button === 0 || event.button === 1;
        })
    );

    initElementSelection(isElementModified); //initial element selection which is either main panel or an element with updated properties
    !isElementModified && (currentTransform.current = null);
    isDropDataReceived.current = true;
    console.log('Mesh data is Updated, Ready to move or select element!');
  }, [meshData]); // Triggered anytime 'meshdata' is changed. most often in modification procedure.

  useEffect(() => {
    isDataReceived.current = true;
  }, [scVersion]);

  /**
   *At the stage of SVG graphic rendering, determines which element should be selected.
   */

  const initElementSelection = function (isElementModified) {
    if (!isElementModified) {
      outSideElementClick(false, false, d3.select('.panel'));
    } else {
      selectedElementIds = elementIds;
      bboxDrawer(boundingBox(), frontPanel);

      //prepare for draeing the refrence cross for single selected element
      const elementsToBeSelected = d3.selectAll('g').filter(function () {
        return +d3.select(this).attr('fpd.id') === +[selectedElementIds];
      });

      if (
        elementsToBeSelected.empty() ||
        !Boolean(elementsToBeSelected.node().firstElementChild)
      )
        return;
      selectedElementIds.length === 1 &&
        crossRefrenceDrawer(frontPanel, elementsToBeSelected.node());
    }
  };

  /**
   *responsible for mutating the 'selected Elements' arrays, which is contained the selected element ids.
   */
  const selection = function (element, shiftKey = false) {
    const elementId = +element.attr('fpd.id');
    isSelectionChanged = false;

    if (shiftKey) {
      // Checks whether any element has been selected or not
      if (frontPanel.select('.BboxRectangle').empty()) {
        selectedElementIds = [elementId];
      } else {
        selectedElementIds = selectedElementIds.includes(elementId) // Checks whether the element id is already in the 'selectedElementIds' which it means the element has already been selected
          ? selectedElementIds.filter((id) => id !== elementId) //if 'true', removes the element ids from the 'selectedElementIds'
          : [...selectedElementIds, elementId]; //if 'false', add the element ids to the 'selectedElementIds'
      }
      isSelectionChanged = true;
    } else if (!selectedElementIds.includes(elementId)) {
      // swap selection
      selectedElementIds = [elementId];
      isSelectionChanged = true;
    }
  };

  /**
   *handles panel outside click event.
   */
  const outSideElementClick = function (shiftKey, isPointerInBBox, doc_id) {
    if (shiftKey || isPointerInBBox) return;
    selection(doc_id);
    removeDrawnBbox();
    isSelectionChanged && sendElementsData();
  };

  /**
   *If the pointer position is within the bounding box area, 'isPointerInBBox' returns true.
   */
  const isPointerInBBox = function ({ x: pointerX, y: pointerY, sourceEvent }) {
    if (frontPanel.select('.BboxRectangle').empty()) return false;
    const { x, y, width, height, right, bottom } =
      sourceEvent.target.nodeName === 'svg'
        ? frontPanel.select('.BboxRectangle').node().getBoundingClientRect()
        : frontPanel.select('.BboxRectangle').node().getBBox();
    return sourceEvent.target.nodeName === 'svg'
      ? pointerX > x &&
          pointerX < right &&
          sourceEvent.y > y &&
          sourceEvent.y < bottom
      : pointerX > x &&
          pointerX < x + width &&
          pointerY > y &&
          pointerY < y + height;
  };

  /**
   * returns precise bounding box based on different elements fill and stroke values
   */
  const getPreciseBbox = (element) => {
    const { x, y, width, height } = element.getBBox();
    let strokeWidth = +element.getAttribute('stroke-width');
    strokeWidth !== 1 ? (strokeWidth /= 2) : (strokeWidth = 0);
    return {
      x: x - strokeWidth,
      y: y - strokeWidth,
      width: width + strokeWidth * 2,
      height: height + strokeWidth * 2,
    };
  };

  /**
   * Returns front-panel elements bounding box. since we have some particular elements which spread in groups with the same id(like #359337320), this function returns precise BBox for all elements including the same id ones.
   */
  function getFpdElementBbox(elementNodes) {
    const bbox = {};
    const elementBboxs = elementNodes.map((element) => getPreciseBbox(element));
    bbox.x = Math.min(...elementBboxs.map(({ x }) => x));
    bbox.y = Math.min(...elementBboxs.map(({ y }) => y));
    bbox.width = Math.max(
      ...elementBboxs.map(({ x, width }) => x - bbox.x + width)
    );
    bbox.height = Math.max(
      ...elementBboxs.map(({ y, height }) => y - bbox.y + height)
    );
    return bbox;
  }

  /**
   * calculates the coordinates of the bounding box for the case of multi-selection.
   */

  function boundingBox() {
    let strokeWidth = 0;
    let unionBboxData = [];
    let bbox = {};
    let prevElId = 0;
    frontPanel.selectAll('g').each(function () {
      if (
        !this.hasAttribute('fpd.panel') &&
        selectedElementIds.includes(+d3.select(this).attr('fpd.id'))
      ) {
        strokeWidth = +d3.select(this).attr('stroke-width');
        strokeWidth !== 1 ? (strokeWidth /= 2) : (strokeWidth = 0);
        bbox = this.getBBox();
        bbox.x -= strokeWidth;
        bbox.y -= strokeWidth;
        bbox.width += strokeWidth * 2;
        bbox.height += strokeWidth * 2;
        unionBboxData.push(bbox);
        // Draws Bbox around each element in the selection. In the case of dragging and selecting a single element, a Box would not be drawn
        if (!isDragged && selectedElementIds.length > 1) {
          if (+this.getAttribute('fpd.id') !== prevElId) {
            const elId = +this.getAttribute('fpd.id');
            const sameElementsPid = frontPanel
              .selectAll('g')
              .filter(function () {
                return +d3.select(this).attr('fpd.id') === elId;
              });

            bboxDrawer(
              getFpdElementBbox(sameElementsPid.nodes()),
              frontPanel,
              true,
              elId
            );
          }
        } else {
          isDragged && frontPanel.select('.innerBboxRectangle').remove();
          prevElId = +this.getAttribute('fpd.id');
        }
      }
    });
    bbox = unionBboxData;
    bbox.x = Math.min(...unionBboxData.map(({ x }) => x));
    bbox.y = Math.min(...unionBboxData.map(({ y }) => y));
    bbox.width = Math.max(
      ...unionBboxData.map(({ x, width }) => x - bbox.x + width)
    );
    bbox.height = Math.max(
      ...unionBboxData.map(({ y, height }) => y - bbox.y + height)
    );
    return bbox;
  }

  /**
   *  Removes the previously selected element drawn bounding box
   */
  function removeDrawnBbox() {
    frontPanel
      .selectAll(
        'rect.BboxRectangle,.innerBboxRectangle,.vertexHandle,#crossRefrenceElement'
      )
      .remove();
  }

  /**
   *  Drawing the bounding box around the selected element or group of elements .
   */

  const bboxDrawer = (
    bbox,
    group,
    innerRect = false,
    elementId,
    color = '#000'
  ) => {
    group
      .append('rect')
      .attr('class', innerRect ? 'innerBboxRectangle' : 'BboxRectangle')
      .attr('id', innerRect ? `box${elementId}` : null)
      .attr('x', bbox.x)
      .attr('y', bbox.y)
      .attr('width', bbox.width)
      .attr('height', bbox.height)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 5')
      .attr('vector-effect', 'non-scaling-stroke');

    if (innerRect) return;
    vertexDrawer(bbox, undefined);
  };
  /**
   *  Resizing element
   *  Code snippets in this section deal with resizing and scaling the selected element(or multi-element)
   */

  const vertexSelectHandler = function (event) {
    const scalingState = 'p';
    this._current = event;
    const BBoxNode = frontPanel.select('.BboxRectangle').node();
    event.inRangeElements = frontPanel
      .selectAll('g')
      .filter(function () {
        return selectedElementIds.includes(+this.getAttribute('fpd.id'));
      })
      .selectChildren();
    this._current.inRangeElements.each(function () {
      this.setAttribute(
        'fpd.te',
        this.transform.baseVal.consolidate().matrix.e
      );
      this.setAttribute(
        'fpd.tf',
        this.transform.baseVal.consolidate().matrix.f
      );
    });
    event.elementBBox = BBoxNode.getBBox();
    event.wBox = BBoxNode.getBBox().width;
  };
  const vertexDragHandler = function (event) {
    const BBoxNode = frontPanel.select('.BboxRectangle').node();
    const vetexHandlerDirType = this.getAttribute('id');
    frontPanel.selectAll('.vertexHandle').remove();
    this.transform.baseVal.consolidate().matrix.e = event.x;
    this.transform.baseVal.consolidate().matrix.f = event.y;

    const direction = {
      'sw-resize': function (BBoxNode) {
        BBoxNode.x.baseVal.value += event.dx;
        BBoxNode.y.baseVal.value += event.dy;
        BBoxNode.width.baseVal.value += -event.dx;
        BBoxNode.height.baseVal.value += -event.dy;
      },
      'se-resize': function (BBoxNode) {
        BBoxNode.y.baseVal.value += event.dy;
        BBoxNode.width.baseVal.value += event.dx;
        BBoxNode.height.baseVal.value -= event.dy;
      },
      'nw-resize': function (BBoxNode) {
        BBoxNode.x.baseVal.value += event.dx;
        BBoxNode.width.baseVal.value -= event.dx;
        BBoxNode.height.baseVal.value += event.dy;
      },
      'ne-resize': function (BBoxNode) {
        BBoxNode.width.baseVal.value += event.dx;
        BBoxNode.height.baseVal.value += event.dy;
      },
    };

    direction[vetexHandlerDirType](frontPanel.select('.BboxRectangle').node());

    let scaleW = BBoxNode.getBBox().width / this._current.elementBBox.width;
    let scaleH = BBoxNode.getBBox().height / this._current.elementBBox.height;
    const boxRight =
      this._current.elementBBox.x + this._current.elementBBox.width;
    const boxHeight =
      this._current.elementBBox.y + this._current.elementBBox.height;
    // --
    const boxLeft = this._current.elementBBox.x;
    const boxDown = this._current.elementBBox.y;
    // --
    const oldBoxW = this._current.elementBBox.width;
    const oldBoxH = this._current.elementBBox.height;
    this._current.inRangeElements.each(function () {
      const elBox = d3.select(
        `g>#box${this.parentNode.getAttribute('fpd.id')}`
      );
      if (!elBox.empty()) {
        frontPanel.select('.innerBboxRectangle').remove();
      }
      Math.sign(this.transform.baseVal.consolidate().matrix.a) > 0
        ? (this.transform.baseVal.consolidate().matrix.a = scaleW)
        : (this.transform.baseVal.consolidate().matrix.a = -scaleW);

      Math.sign(this.transform.baseVal.consolidate().matrix.d) > 0
        ? (this.transform.baseVal.consolidate().matrix.d = scaleH)
        : (this.transform.baseVal.consolidate().matrix.d = -scaleH);

      const deltaW =
        this.getBBox().width * (BBoxNode.getBBox().width / oldBoxW - 1);
      const deltaH =
        this.getBBox().height * (BBoxNode.getBBox().height / oldBoxH - 1);

      const newX = +this.getAttribute('fpd.te') - deltaW / 2;
      const newY = +this.getAttribute('fpd.tf') - deltaH / 2;

      const distBoxRight =
        boxRight - (+this.getAttribute('fpd.te') + this.getBBox().width / 2);
      const distBoxLeft =
        boxLeft - (+this.getAttribute('fpd.te') + this.getBBox().width / 2);
      const distBoxTop =
        boxHeight - (+this.getAttribute('fpd.tf') + this.getBBox().height / 2);
      const distBoxDown =
        boxDown - (+this.getAttribute('fpd.tf') + this.getBBox().height / 2);
      if (
        vetexHandlerDirType === 'nw-resize' ||
        vetexHandlerDirType === 'sw-resize'
      ) {
        this.transform.baseVal.consolidate().matrix.e =
          newX - (distBoxRight * scaleW - distBoxRight);
      }
      if (
        vetexHandlerDirType === 'sw-resize' ||
        vetexHandlerDirType === 'se-resize'
      ) {
        this.transform.baseVal.consolidate().matrix.f =
          newY - (distBoxTop * scaleH - distBoxTop);
      }
      if (
        vetexHandlerDirType === 'se-resize' ||
        vetexHandlerDirType === 'ne-resize'
      ) {
        this.transform.baseVal.consolidate().matrix.e =
          newX - (distBoxLeft * scaleW - distBoxLeft);
      }
      if (
        vetexHandlerDirType === 'nw-resize' ||
        vetexHandlerDirType === 'ne-resize'
      ) {
        this.transform.baseVal.consolidate().matrix.f =
          newY - (distBoxDown * scaleH - distBoxDown);
      }
    });
  };

  const vertexReleaseHandler = function (event) {
    vertexDrawer(frontPanel.select('.BboxRectangle').node().getBBox());
  };

  const vertexDrawer = function (
    bbox,
    symbolSize = scaleFactor() < 2 ? scaleFactor() : 2
  ) {
    const squareHandle = d3.symbol().type(d3.symbolSquare).size(symbolSize);
    const sqHw = Math.sqrt(symbolSize) / 2;

    frontPanel
      .append('path')
      .attr('class', 'vertexHandle')
      .attr('id', 'sw-resize')
      .attr('d', squareHandle())
      .attr('transform', `translate(${bbox.x - sqHw},${bbox.y - sqHw})`)
      .call(
        d3
          .drag()
          .on('start', vertexSelectHandler)
          .on('drag', vertexDragHandler)
          .on('end', vertexReleaseHandler)
      )
      .on('mouseover', function () {
        d3.select(this).style('cursor', 'nesw-resize');
      });
    //se----------------
    frontPanel
      .append('path')
      .attr('class', 'vertexHandle')
      .attr('id', 'se-resize')
      .attr('d', squareHandle())
      .attr(
        'transform',
        `translate(${bbox.x + bbox.width + sqHw},${bbox.y - sqHw})`
      )
      .call(
        d3
          .drag()
          .on('start', vertexSelectHandler)
          .on('drag', vertexDragHandler)
          .on('end', vertexReleaseHandler)
      )
      .on('mouseover', function () {
        d3.select(this).style('cursor', 'nwse-resize');
      });
    // nw==========
    frontPanel
      .append('path')
      .attr('class', 'vertexHandle')
      .attr('id', 'nw-resize')
      .attr('d', squareHandle())
      .attr('transform', function () {
        return `translate(${bbox.x - sqHw},${bbox.y + bbox.height + sqHw})`;
      })
      .call(
        d3
          .drag()
          .on('start', vertexSelectHandler)
          .on('drag', vertexDragHandler)
          .on('end', vertexReleaseHandler)
      )
      .on('mouseover', function () {
        d3.select(this).style('cursor', 'nwse-resize');
      });

    //ne---------------
    frontPanel
      .append('path')
      .attr('class', 'vertexHandle')
      .attr('id', 'ne-resize')
      .attr('d', squareHandle())
      .attr(
        'transform',
        `translate(${bbox.x + bbox.width + sqHw},${
          bbox.y + bbox.height + sqHw
        })`
      )
      .call(
        d3
          .drag()
          .on('start', vertexSelectHandler)
          .on('drag', vertexDragHandler)
          .on('end', vertexReleaseHandler)
      )
      .on('mouseover', function () {
        d3.select(this).style('cursor', 'nesw-resize');
      });
  };
  /**
   *  draws the crossRefrence at the selected element center.
   */
  const crossRefrenceDrawer = (group, currentElement) => {
    const { e, f } = currentElement.firstElementChild.transform.baseVal // we take e(as x) and f (as y) of the element as the current position of the element after applying the initial transformation
      .consolidate().matrix;
    const crossScale = scaleFactor() < 2 ? scaleFactor() : 2;
    group
      .append('path')
      .attr('id', 'crossRefrenceElement')
      .attr('d', `M-1,0L1,0M0,-1L0,1Z`)
      .attr('stroke', 'red')
      .attr('stroke-width', 1)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('transform', `matrix(${[crossScale, 0, 0, crossScale, e, f]})`);
  };

  /**
   *  Sets the transformation of the Canvas while zooming action is performed.
  
   */
  function zoomHandler(event) {
    const { k, x, y } = event.transform;
    const viewBox = svgElement.node().viewBox.baseVal;
    // event.sourceEvent.type === 'mousemove'
    //   ? d3.select(this).style('cursor', 'grab')
    //   : d3.select(this).style('cursor', null);

    /**
     * Sets Transformation Matrix based on : [scale x, b, c, scale y, translate x, translate y];
     * it's been understood that in order to prevent misbehavior of zooming while we are using the firefox, we have to get the value of
     * transformation in the middle of the zooming action
     */
    const frontPanelTransform = frontPanel
      .node()
      .transform.baseVal.consolidate().matrix;
    // As parameters 'a' and 'd' are responsible for scaling, they should be updated correspondingly during zooming
    frontPanelTransform.a = k;
    frontPanelTransform.d = -k;
    //parameter 'e' is also responsible for the translation factor of 'x'
    frontPanelTransform.e = x;
    // We already have mesh data with reversed 'y' parameter, so we need to calculate the proper y factor based on the height of the panel during zooming action.
    frontPanelTransform.f = y + k * viewBox.height;

    currentTransform.current = frontPanel.attr('transform');

    //scaling the crossRefrence-element while zoom is performing
    const crossScale = scaleFactor() < 2 ? scaleFactor() : 2;
    const CrossEl =
      !frontPanel.select('#crossRefrenceElement').empty() &&
      frontPanel
        .select('#crossRefrenceElement')
        .node()
        .transform.baseVal.consolidate().matrix;
    const vertexHandle =
      !frontPanel.select('.vertexHandle').empty() &&
      frontPanel.select('.vertexHandle').node().transform.baseVal.consolidate()
        .matrix;
    if (CrossEl) {
      CrossEl.a = crossScale;
      CrossEl.d = crossScale;
    }
    if (vertexHandle) {
      frontPanel.selectAll('.vertexHandle').remove();
      vertexDrawer(
        frontPanel.select('.BboxRectangle').node().getBBox(),
        crossScale
      );
    }
  }

  /**
   * Sets the respective react's states that are responsible for triggering the appropriate function for sending elements data to the server.
   */
  const sendElementsData = function () {
    isDataReceived.current = false;
    context.updateFpdData((prevState) => ({
      ...prevState,
      elementIds: selectedElementIds,
    }));
  };

  /**
   * gets x and y in order to moving element while dragging
   */
  const moveElement = function (dx, dy, bbox) {
    frontPanel.selectAll('.vertexHandle').remove();
    frontPanel.selectAll('g').each(function () {
      if (selectedElementIds.includes(+d3.select(this).attr('fpd.id'))) {
        d3.select(this)
          .selectChildren()
          .each(function () {
            this.transform.baseVal.consolidate().matrix.e += dx;
            this.transform.baseVal.consolidate().matrix.f += dy;
          });
      }
    });
    frontPanel
      .select('.BboxRectangle')
      .attr('x', bbox.x + dx)
      .attr('y', bbox.y + dy);
    frontPanel.selectAll('#crossRefrenceElement').each(function () {
      this.transform.baseVal.consolidate().matrix.e += dx;
      this.transform.baseVal.consolidate().matrix.f += dy;
    });
  };
  // maps canvase x and y to viewBox coordinate and returns transformed coordinates
  function transformCanvasToViewbox(x, y) {
    const svgPoint = svgElement.node().createSVGPoint();
    svgPoint.x = x;
    svgPoint.y = y;

    return svgPoint.matrixTransform(frontPanel.node().getCTM().inverse());
  }

  //Calculates new coordinate based on given initil value
  function updatedCoordinate(
    newMousePosition,
    oldMousePosition,
    initialCoordinate
  ) {
    const { x: newX, y: newY } = newMousePosition;
    const { x: oldX, y: oldY } = oldMousePosition;
    const [initX, initY] = initialCoordinate;
    const deltaX = newX - oldX;
    const deltaY = newY - oldY;
    return [deltaX + initX, deltaY + initY];
  }

  //Draw the range-selection-box in order to select multi-element
  function drawingBoxPath(event, source) {
    const { x, y } =
      source === 'canvas' ? transformCanvasToViewbox(event.x, event.y) : event;
    const { x: initX, y: initY } =
      source === 'canvas'
        ? transformCanvasToViewbox(event.subject.x, event.subject.y)
        : event.subject;
    return [
      `M ${initX},${initY}L${x},${initY}L${x},${y}L${initX},${y}z`,
      initX > x,
    ];
  }

  //Grab 'x' and 'y' as the initial position value
  function initialCoordinate() {
    return d3
      .selectAll('input')
      .filter(function () {
        return (
          d3.select(this).attr('id') === 'X' ||
          d3.select(this).attr('id') === 'Y'
        );
      })
      .nodes()
      .map((prop) => +[prop.value.match(/-?\d+.?\d*/)]);
  }

  /**
   * Determines which element are in the selection range after a drawing-box is drawn
   */
  function DrawBoxInsideElDetector(
    { x: BoxX, y: BoxY, width: BoxW, height: BoxH },
    touched
  ) {
    let elementInRangeIds = frontPanel
      .selectAll('g')
      .filter(function () {
        const { x, y, width, height } = this.getBBox();
        return touched
          ? !this.hasAttribute('fpd.panel') && //the 'touched' is true, which means the user has drawn a box from right to left.So any element that is touched by the box is considered inside the box.
              x + width > BoxX &&
              BoxY + BoxH > y &&
              y + height > BoxY &&
              BoxX + BoxW > x
          : !this.hasAttribute('fpd.panel') && // the 'touched' is false, which means the user has drawn a box from left to right.So, only elements that are enlcosed by the box are considered inside the box.
              x > BoxX &&
              BoxY + BoxH > y + height &&
              y > BoxY &&
              BoxX + BoxW > x + width;
      })
      .nodes()
      .map((elementInRange) => +elementInRange.getAttribute('fpd.id'));

    // Checks whether the element id is already in the 'selectedElementIds' which it means the element has already been selected
    elementInRangeIds = elementInRangeIds.filter(
      (elementInRange) => !selectedElementIds.includes(elementInRange)
    );

    if (!elementInRangeIds.length) return; //It means no element included in the range selection
    selectedElementIds = d3.select('.BboxRectangle').empty() // Checks if the selection box is empty or already drawn
      ? (selectedElementIds = elementInRangeIds) //if 'empty', it just adds  elements in range Ids to the selected element ids
      : [...selectedElementIds, ...elementInRangeIds]; //In the case of 'it is already drawn', which means the user is holding the shift key, it adds the selection to the array

    selectedElementIds.length === 1 &&
      crossRefrenceDrawer(
        frontPanel,
        d3
          .selectAll('g')
          .filter(function () {
            return +d3.select(this).attr('fpd.id') === +[selectedElementIds];
          })
          .node()
      );
    !d3.select('.BboxRectangle').empty() && removeDrawnBbox();
    bboxDrawer(boundingBox(), frontPanel);
    sendElementsData();
  }
  /**
   * calculates the size of cross lines based on proportion of wdith and height of panel and scale factor as well
   */

  const scaleFactor = function (
    currentPanelScale = frontPanel.node().transform.baseVal.consolidate().matrix
      .a
  ) {
    const { width } = frontPanel.node().getBBox();

    return width > 100
      ? width / (100 * currentPanelScale)
      : 1 / currentPanelScale;
  };

  /**
   * Overlapping detecor
   * Returns elements (paths) covering the mouse position [the front panel element should not be considered]. If no element overlaps the selected element, only the element itself will be returned
   */

  // Returns elements where the paths intersect at the position of the mouse click.
  const elementsThatCoverMouseByPath = function ({ clientX, clientY }) {
    return document
      .elementsFromPoint(clientX, clientY)
      .filter(
        (element) =>
          element.parentNode.nodeName === 'g' &&
          !element.parentNode.hasAttribute('fpd.panel')
      );
  };

  const elementsExtraStroke = function ({ clientX, clientY }) {
    for (let i = 0; i < 100; i += 2) {
      let el = document
        .elementsFromPoint(clientX - i, clientY)
        .filter(
          (element) =>
            element.parentNode.nodeName === 'g' &&
            !element.parentNode.hasAttribute('fpd.panel') &&
            +element.parentNode.getAttribute('stroke-width') !== 1
        );
      if (el.length > 0) {
        console.log(el[0].parentNode.getAttribute('stroke-width'));
        return;
      }
      el = document
        .elementsFromPoint(clientX + i, clientY)
        .filter(
          (element) =>
            element.parentNode.nodeName === 'g' &&
            !element.parentNode.hasAttribute('fpd.panel') &&
            +element.parentNode.getAttribute('stroke-width') !== 1
        );
      if (el.length > 0) {
        console.log(el[0].parentNode.getAttribute('stroke-width'));
        return;
      }
      // el.length > 0 && console.log(el, i, clientX + i, [clientX, clientY]);
    }
  };

  // When the user hovers over an overlapped element list item, the 'overLappedHoverHandler' is triggered.
  const overLappedHoverHandler = function (event) {
    console.log(event);
    const elId = +this.name;
    this._current = event;
    this._current.selectedElement = frontPanel
      .selectAll('g')
      .filter(function () {
        return +this.getAttribute('fpd.id') === elId;
      });
    frontPanel.selectAll('.innerBboxRectangle').remove();
    bboxDrawer(
      getFpdElementBbox(this._current.selectedElement.nodes()),
      frontPanel,
      true,
      +this.name,
      'red'
    );
  };

  // Whenever the user clicks an overlapped element list item, overLappedClickHandler is triggered.
  const overLappedClickHandler = function (event) {
    frontPanel.selectAll('.innerBboxRectangle').remove();
    d3.selectAll('.modal,.dialogBox').remove();
    elementSelection(this._current.selectedElement, event.shiftKey);
  };

  // When the user click on the modal, 'modalClickHandler' is triggered.
  const modalClickHandler = function (event) {
    const elId = frontPanel
      .selectAll('.innerBboxRectangle')
      .node()
      .getAttribute('id')
      .replace('box', '');
    const selectedElement = d3.selectAll('g').filter(function () {
      return +this.getAttribute('fpd.id') === +elId;
    });
    d3.selectAll('.modal,.dialogBox').remove();
    elementSelection(selectedElement, event.shiftKey);
  };

  const contextmenuHandler = function (event) {
    const btnTest = d3.selectAll('input').filter(function () {
      return this.getAttribute('name') === '3809123568';
    });
    btnTest.dispatch('mouseover');
    // console.log('right click', btnTest);
    event.preventDefault();
  };

  // Provides a dialog box containing a list of overlapped elements
  const overlapDialogBox = function ({ clientX, clientY }) {
    const dialogBox = d3.create('div');
    dialogBox
      .style('opacity', 0.8)
      .attr('class', 'dialogBox')
      .style('background-color', '#696969')
      .style('color', '#fff')
      .style('border', 'solid')
      .style('border-width', '2px')
      .style('border-radius', '5px')
      .style('padding', '5px')
      .style('position', 'absolute')
      .style('overflow', 'hidden')
      .style('top', `${clientY}px`)
      .style('left', `${clientX}px`);

    return dialogBox.node();
  };

  // Creates a transparent div element that covers the whole screen when overlapping dialog boxes are rendered
  const modalCreatyeor = function () {
    const modal = d3.create('div');
    modal
      .style('opacity', 0)
      .attr('class', 'modal')
      .style('position', 'absolute')
      .style('overflow', 'hidden')
      .style('width', '100%')
      .style('height', '100%')
      .style('top', '0')
      .style('left', '0')
      .on('click', modalClickHandler)
      .on('contextmenu', contextmenuHandler);

    return modal.node();
  };

  // creates the list of over-lapped elements as a button list for providing the overlap dialog box with items
  const overlapListItemCreator = function (data, headerText) {
    isDataReceived.current = false;
    const overlapModal = d3
      .select('.dialogBox')
      .html(`<header>${headerText}</header>`)
      .append('ul')
      .attr('id', 'overLapeedList')
      .style('list-style-type', 'none')
      .style('width', '100%');
    data.map((item, i) => {
      overlapModal
        .append('li')
        .append('input')
        .attr('type', 'button')
        .style('width', '100%')
        .attr('class', 'chakra-button css-dmlo37')
        .attr('width', '100%')
        .attr('name', item)
        .attr('value', `Element${i}`)
        .on('mouseover', overLappedHoverHandler)
        .on('click', overLappedClickHandler);
      overlapModal.append('li').html('<hr>');
    });
    if (
      overlapModal.node().getBoundingClientRect().bottom > window.innerHeight
    ) {
      d3.select('.dialogBox').style(
        'top',
        `${
          d3.select('.dialogBox').node().getBoundingClientRect().top -
          (d3.select('.dialogBox').node().getBoundingClientRect().bottom -
            window.innerHeight)
        }px`
      );
    }
  };

  /**
   * Element selection
   * Triggers when an element selection event occurs
   */
  const elementSelection = function (element, shiftKey) {
    selection(element, shiftKey);
    !isSelectionChanged && console.log('[element in selection]');
    if (!isSelectionChanged) return;
    removeDrawnBbox();
    if (selectedElementIds.length === 0)
      return outSideElementClick(shiftKey, false, d3.select('.panel'));
    bboxDrawer(boundingBox(), frontPanel);
    selectedElementIds.length === 1 &&
      crossRefrenceDrawer(
        // filters which element should be selected. It's not always the same element selected due to the probability of holding the shift key.
        frontPanel,
        d3
          .selectAll('g')
          .filter(function () {
            return +d3.select(this).attr('fpd.id') === +[selectedElementIds];
          })
          .node()
      );
    sendElementsData();
  };
  //---------- SELECTION EVENTS HANDLERS------------

  /**
   *handles panel outside click event.
   */
  const canvasClickHandler = function (event) {
    console.log('----\n1. SVG is selected');
    if (!isDataReceived.current || !isDropDataReceived.current) {
      event.on('drag', null);
      event.on('end', null);
      return;
    }
    prevPosition = transformCanvasToViewbox(
      event.sourceEvent.clientX,
      event.sourceEvent.clientY
    );
    outSideElementClick(
      event.sourceEvent.shiftKey,
      isPointerInBBox(event),
      frontPanel.select('.panel')
    );
    prevDragPosition = transformCanvasToViewbox(event.x, event.y);
  };
  /**
   * handles the main panel click event.
   */
  const panelClickHandler = function (event) {
    console.log('----\n1. panel is selected');
    if (!isDataReceived.current || !isDropDataReceived.current) {
      event.on('drag', null);
      event.on('end', null);
      return;
    }
    elementsExtraStroke(event.sourceEvent);
    outSideElementClick(
      event.sourceEvent.shiftKey,
      isPointerInBBox(event),
      d3.select(this)
    );
  };

  /**
   * handles an element click event.
   */
  const elementClickHandler = function (event) {
    console.log('----\nelement is selected');

    if (!isDataReceived.current || !isDropDataReceived.current) {
      event.on('drag', null);
      event.on('end', null);
      return;
    }
    if (
      !frontPanel.select('.BboxRectangle').empty() &&
      !event.sourceEvent.shiftKey &&
      isPointerInBBox(event)
    )
      return;
    // it contains the elements that intersect each other.
    const overlapsIds = Array.from(
      new Set(
        elementsThatCoverMouseByPath(event.sourceEvent).map((element) =>
          element.parentNode.getAttribute('fpd.id')
        )
      )
    );
    // Overlap occurs if the 'overlapsIds' contains more than one element with a different id.
    if (overlapsIds.length > 1) {
      const elId = +this.getAttribute('fpd.id');
      const selectedElement = frontPanel.selectAll('g').filter(function () {
        return +this.getAttribute('fpd.id') === elId;
      });

      bboxDrawer(
        getFpdElementBbox(selectedElement.nodes()),
        frontPanel,
        true,
        this.getAttribute('fpd.id'),
        'red'
      );
      d3.selectAll('.modal,.dialogBox').remove();
      document.body.appendChild(modalCreatyeor(event.sourceEvent));
      document.body.appendChild(overlapDialogBox(event.sourceEvent));
      overlapListItemCreator(overlapsIds, 'Select an element:');
    } else {
      elementSelection(d3.select(this), event.sourceEvent.shiftKey);
    }
  };

  //---------- DRAGGING EVENTS HANDLERS------------
  const elementDragHandler = function (event) {
    if (!isDataReceived.current || !isDropDataReceived.current) {
      event.on('drag', null);
      event.on('end', null);
      return;
    }
    if (
      (this.hasAttribute('fpd.panel') &&
        frontPanel.select('.BboxRectangle').empty()) || // Adding an element to a selection by drawing a box while holding the 'shift key' is the second part of the condition
      (this.hasAttribute('fpd.panel') &&
        event.sourceEvent.shiftKey &&
        !frontPanel.select('.BboxRectangle').empty() &&
        !isPointerInBBox(event)) ||
      (isPointerInBBox(event) && d3.select('#selectionBox').attr('d')) // When the user is about to draw a selection and touches an already selected box, nothing should happen
    ) {
      const [path, touched] = drawingBoxPath(event, 'path');
      frontPanel
        .select('#selectionBox')
        .attr('d', path)
        .classed('touched', touched);
      return;
    }

    const { dx, dy } = event;
    isDragged = true;
    moveElement(dx, dy, boundingBox());
  };

  const CanvasDragHandler = function (event) {
    if (!isDataReceived.current || !isDropDataReceived.current) {
      event.on('drag', null);
      event.on('end', null);
      return;
    }

    if (
      frontPanel.select('.BboxRectangle').empty() || // Adding an element to a selection by drawing a box while holding the 'shift key' is the second part of the condition
      (event.sourceEvent.shiftKey &&
        !frontPanel.select('.BboxRectangle').empty() &&
        !isPointerInBBox(event)) ||
      (isPointerInBBox(event) && d3.select('#selectionBox').attr('d')) // When the user is about to draw a selection and touches an already selected box, the drawing should continue)
    ) {
      const [path, touched] = drawingBoxPath(event, 'canvas');
      frontPanel
        .select('#selectionBox')
        .attr('d', path)
        .classed('touched', touched);
      return;
    }
    const { x: userCoordinateX, y: userCoordinateY } = transformCanvasToViewbox(
      event.x,
      event.y
    );

    const dx = userCoordinateX - prevDragPosition.x;
    const dy = userCoordinateY - prevDragPosition.y;
    isDragged = true;
    moveElement(dx, dy, boundingBox());
    prevDragPosition = transformCanvasToViewbox(event.x, event.y);
  };

  // ---------RELEASE EVENTS HANDLERS-----------

  const elementReleaseHandler = function (event) {
    const drawingBoxPathRectangle = frontPanel.select('#selectionBox'); // we grab the drawing-box selection
    if (drawingBoxPathRectangle.node().hasAttribute('d')) {
      // checks if the drawing box is drawn or not. (If the drawing box is already drawn, there will be a value in the 'd' attribute) )
      DrawBoxInsideElDetector(
        drawingBoxPathRectangle.node().getBBox(),
        drawingBoxPathRectangle.classed('touched')
      );
      drawingBoxPathRectangle.attr('d', null);
    }
    if (
      !isDragged ||
      (selectedElementIds.length !== 1 &&
        frontPanel.select('.BboxRectangle').empty())
    )
      return;
    const newPosition = this.hasAttribute('viewBox')
      ? updatedCoordinate(
          transformCanvasToViewbox(
            event.sourceEvent.clientX,
            event.sourceEvent.clientY
          ),
          prevPosition,
          initialCoordinate()
        )
      : updatedCoordinate(event, event.subject, initialCoordinate());

    isDragged = false;
    /**
     * TODO: For making a decision on how to treat the image element, the following lines remain commented:
     */

    // const selectedPath = frontPanel.selectAll('g').filter(function () {
    //   if (selectedElementIds.includes(+d3.select(this).attr('fpd.id'))) {
    //     return d3.select(this);
    //   }
    // });
    // const { e, f } = selectedPath
    //   .node()
    //   .firstElementChild.transform.baseVal.consolidate().matrix;
    context.updateFpdData((prevState) => ({
      ...prevState,
      Coordinate: newPosition,
    }));
    isDropDataReceived.current = false;
  };

  return <div ref={svgFpRef} />;
};
export default D3ren;


method: 'POST',
url: `${API_URL}/panel/${panelName}`,
headers: { 'Content-Type': 'application/octet-stream' },
data: fileData,


return {
  method: 'POST',
  url: `${API_URL}/docs/upload`,
  data: formData,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  transformRequest: [
    (formData, headers) => {
      //Transform request data as you prefer

      return formData;
    },
  ],
};

export const uploadFrontPanelFile = (panelName, fileData) => {
  let formData = new FormData();
  formData.append('file', fileData);
  formData.append('name', panelName);
  formData.append('description', 'This is considered as a test description');
  return {
    method: 'POST',
    url: `${API_URL}/docs/upload`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  };
};
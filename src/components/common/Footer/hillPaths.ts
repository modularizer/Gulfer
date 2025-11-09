// Path generation functions for hill-shaped footer

export const FOOTER_HEIGHT = 80;
export const HILL_HEIGHT = 34;
export const VALLEY_DEPTH = 20;
export const TOTAL_HEIGHT = FOOTER_HEIGHT;

export const createSmoothHillPath = (width: number): string => {
  const leftPeak = width * 0.35;
  const rightPeak = width * 0.75;
  const center = width * 0.5;
  

  return `M 0 ${TOTAL_HEIGHT}
          L 0 ${HILL_HEIGHT}
          Q ${leftPeak} 0 ${center - 60} ${HILL_HEIGHT + VALLEY_DEPTH * 0.3}
          Q ${center} ${HILL_HEIGHT + VALLEY_DEPTH} ${center + 70} ${HILL_HEIGHT + VALLEY_DEPTH * 0.3}
          Q ${rightPeak} 0 ${width} ${HILL_HEIGHT}
          L ${width} ${TOTAL_HEIGHT}
          Z`;
};

export const createLeftHillPath = (width: number): string => {
  const leftPeak = width * 0.25;
  const center = width * 0.5;
  
  return `M 0 ${TOTAL_HEIGHT}
          L 0 ${HILL_HEIGHT}
          Q ${leftPeak} 0 ${center - 30} ${HILL_HEIGHT + VALLEY_DEPTH * 0.3}
          Q ${center - 15} ${HILL_HEIGHT + VALLEY_DEPTH * 0.6} ${center - 30} ${TOTAL_HEIGHT}
          Z`;
};

export const createValleyPath = (width: number): string => {
  const center = width * 0.5;
  
  return `M ${center - 30} ${TOTAL_HEIGHT}
          Q ${center - 15} ${HILL_HEIGHT + VALLEY_DEPTH * 0.6} ${center - 30} ${HILL_HEIGHT + VALLEY_DEPTH * 0.3}
          Q ${center} ${HILL_HEIGHT + VALLEY_DEPTH} ${center + 30} ${HILL_HEIGHT + VALLEY_DEPTH * 0.3}
          Q ${center + 15} ${HILL_HEIGHT + VALLEY_DEPTH * 0.6} ${center + 30} ${TOTAL_HEIGHT}
          Z`;
};

export const createRightHillPath = (width: number): string => {
  const rightPeak = width * 0.75;
  const center = width * 0.5;
  
  return `M ${center + 30} ${TOTAL_HEIGHT}
          Q ${center + 15} ${HILL_HEIGHT + VALLEY_DEPTH * 0.6} ${center + 30} ${HILL_HEIGHT + VALLEY_DEPTH * 0.3}
          Q ${rightPeak} 0 ${width} ${HILL_HEIGHT}
          L ${width} ${TOTAL_HEIGHT}
          Z`;
};


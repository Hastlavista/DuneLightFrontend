export interface OverlapLayoutSlot {
  lane: number;
  lanes: number;
}

interface TimedItem {
  id: string;
  startMinutes: number;
  durationMinutes: number;
}

/** Google Calendar-style side-by-side layout for overlapping appointments
 * within a single grid column. Backend allows overlaps (double-booking isn't
 * blocked, only warned about - see AppointmentDto.warnings), so the grid must
 * render them side by side rather than stacked/hidden.
 *
 * Groups items into clusters of mutually-touching overlaps (a chain, not just
 * pairwise), assigns each item the first free lane within its cluster
 * (classic interval graph coloring), then gives every item in a cluster an
 * equal share of the column width (1/laneCount) - so a 3-way overlap divides
 * the column into thirds, not into whatever any single pairwise comparison
 * would suggest. */
export function computeOverlapLayout(items: TimedItem[]): Map<string, OverlapLayoutSlot> {
  const result = new Map<string, OverlapLayoutSlot>();
  const sorted = [...items].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.durationMinutes - b.durationMinutes,
  );

  let cluster: TimedItem[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = (): void => {
    if (cluster.length === 0) {
      return;
    }
    const laneEnds: number[] = [];
    for (const item of cluster) {
      const end = item.startMinutes + item.durationMinutes;
      let lane = laneEnds.findIndex((laneEndMinutes) => laneEndMinutes <= item.startMinutes);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      result.set(item.id, { lane, lanes: 0 });
    }
    const lanes = laneEnds.length;
    for (const item of cluster) {
      result.get(item.id)!.lanes = lanes;
    }
    cluster = [];
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.startMinutes + item.durationMinutes);
  }
  flushCluster();

  return result;
}

// The compare tray: kept analysis snapshots tabulated side by side, grouped by domain, so an
// analyst can weigh trade cases ACROSS every result kind (Wave 2B generalized the snapshot model
// so EVERY result block can be kept). Each domain group is a table whose columns are the union of
// that domain's snapshot metric keys; rows are the kept snapshots. Presentational: it reads the
// keptSnapshots slice and calls the engine to remove/clear/export. Reuses ReportTable for the grid.

import { Button } from '@bessel/selene-design';
import { ReportTable, downloadBlob } from '@bessel/ui';
import type { BesselEngine } from '../engine/index.ts';
import { useStore, type AppStore, type KeptSnapshot } from '../store/index.ts';

export interface CompareTrayProps {
  readonly engine: BesselEngine | null;
  readonly store: AppStore;
}

/** A snapshot metric value rendered as a string ('-' for a missing key in the metric union). */
const cell = (v: string | number | undefined): string => (v === undefined ? '-' : String(v));

/** The distinct domains present, in first-seen order. */
function domainsOf(snapshots: readonly KeptSnapshot[]): readonly KeptSnapshot['domain'][] {
  return [...new Set(snapshots.map((s) => s.domain))];
}

/** The UNION of metric keys across a domain's snapshots, in first-seen order (so two snapshots of
 *  the same kind share columns, and a kind that carries an extra metric appends it). */
function metricKeysOf(group: readonly KeptSnapshot[]): readonly string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const s of group) {
    for (const k of Object.keys(s.metrics)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

/** Serialize kept snapshots to CSV, one section per domain (rows = metric, columns = snapshots). */
function toCsv(snapshots: readonly KeptSnapshot[]): string {
  return (
    domainsOf(snapshots)
      .map((domain) => {
        const group = snapshots.filter((s) => s.domain === domain);
        const keys = metricKeysOf(group);
        const head = ['metric', ...group.map((s) => s.label)].join(',');
        const rows = keys.map((k) => [k, ...group.map((s) => cell(s.metrics[k]))].join(','));
        return [`domain: ${domain}`, head, ...rows].join('\n');
      })
      .join('\n\n') + '\n'
  );
}

export function CompareTray(props: CompareTrayProps): JSX.Element {
  const { engine, store } = props;
  const snapshots = useStore(store, (s) => s.keptSnapshots);

  if (snapshots.length === 0) {
    return (
      <p className="bessel-loader-hint" data-testid="compare-empty">
        Keep any analysis result (lighting, access, conjunction, coverage, orbit, link) to compare
        trade cases here.
      </p>
    );
  }

  return (
    <div className="bessel-compare-tray" data-testid="compare-tray">
      <div className="bessel-compare-tools">
        <Button
          variant="secondary"
          testId="compare-csv"
          onClick={() => downloadBlob(new Blob([toCsv(snapshots)], { type: 'text/csv' }), 'compare.csv')}
        >
          Export CSV
        </Button>
        <Button variant="ghost" testId="compare-clear" onClick={() => engine?.clearSnapshots()}>
          Clear
        </Button>
      </div>
      {domainsOf(snapshots).map((domain) => {
        const group = snapshots.filter((s) => s.domain === domain);
        const keys = metricKeysOf(group);
        return (
          <div key={domain} data-testid={`compare-domain-${domain}`}>
            <div className="bessel-compare-chips">
              {group.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="bessel-snapshot-remove"
                  aria-label={`Remove ${s.label}`}
                  data-testid={`snapshot-remove-${s.id}`}
                  onClick={() => engine?.removeSnapshot(s.id)}
                >
                  {s.label} <span aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
            <ReportTable
              testId="compare-table"
              columns={[domain, ...group.map((s) => s.label)]}
              rows={keys.map((k) => [k, ...group.map((s) => cell(s.metrics[k]))])}
            />
          </div>
        );
      })}
    </div>
  );
}

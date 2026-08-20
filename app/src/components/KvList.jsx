import { Fragment } from "react";

export function KvList({ rows }) {
  return (
    <dl className="kv">
      {rows.map(([label, node], i) => (
        <Fragment key={i}>
          <dt>{label}</dt>
          <dd>{node}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

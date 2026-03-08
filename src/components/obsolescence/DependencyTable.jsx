import React, { useState, useMemo } from "react";
import { ArrowUpDown, AlertCircle } from "lucide-react";
import UpdateTypeBadge from "./UpdateTypeBadge";

export default function DependencyTable({ dependencies }) {
  const [sortKey, setSortKey] = useState("package_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    let items = [...(dependencies || [])];

    if (filter) {
      const lc = filter.toLowerCase();
      items = items.filter((d) => d.package_name.toLowerCase().includes(lc));
    }

    items.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

    return items;
  }, [dependencies, sortKey, sortAsc, filter]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const columns = [
    { key: "package_name", label: "Package" },
    { key: "current_version", label: "Actuelle" },
    { key: "latest_version", label: "Derniere" },
    { key: "update_type", label: "Type" },
    { key: "days_behind", label: "Retard (j)" },
  ];

  if (!dependencies || dependencies.length === 0) {
    return <div className="obs-table-empty">Aucune dependance dans ce rapport.</div>;
  }

  return (
    <div className="obs-table-wrapper">
      <div className="obs-table-toolbar">
        <input
          type="text"
          placeholder="Filtrer par nom de package..."
          className="input obs-table-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="obs-table-count">{sorted.length} dependance{sorted.length > 1 ? "s" : ""}</span>
      </div>
      <div className="obs-table-scroll">
        <table className="obs-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)}>
                  <span className="obs-th-inner">
                    {col.label}
                    <ArrowUpDown size={12} />
                  </span>
                </th>
              ))}
              <th>Deprecated</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((dep) => (
              <tr key={dep.id || dep.package_name}>
                <td className="obs-td-mono">{dep.package_name}</td>
                <td className="obs-td-mono">{dep.current_version}</td>
                <td className="obs-td-mono">{dep.latest_version}</td>
                <td>
                  <UpdateTypeBadge type={dep.update_type} />
                </td>
                <td className="obs-td-number">{dep.days_behind || 0}</td>
                <td>
                  {dep.is_deprecated && (
                    <span className="obs-badge obs-badge-deprecated">
                      <AlertCircle size={12} />
                      deprecated
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

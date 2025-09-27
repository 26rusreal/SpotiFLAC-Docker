import React from "react";

interface StatCard {
  id: string;
  label: string;
  value: number;
  description: string;
  accent: string;
}

interface DashboardHeaderProps {
  runningCount: number;
  pendingCount: number;
  completedCount: number;
  availableStores: number;
  queueTotal: number;
  lastHistoryUpdate: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  runningCount,
  pendingCount,
  completedCount,
  availableStores,
  queueTotal,
  lastHistoryUpdate
}) => {
  const statCards: StatCard[] = [
    {
      id: "running",
      label: "Активные",
      value: runningCount,
      description: "сейчас выполняются",
      accent: "accent-green"
    },
    {
      id: "pending",
      label: "В ожидании",
      value: pendingCount,
      description: "стоят в очереди",
      accent: "accent-amber"
    },
    {
      id: "completed",
      label: "Завершено",
      value: completedCount,
      description: "успешно обработано",
      accent: "accent-blue"
    },
    {
      id: "stores",
      label: "Источники",
      value: availableStores,
      description: "доступных магазина",
      accent: "accent-cyan"
    }
  ];

  const queueBadge =
    queueTotal > 0 ? `${queueTotal} задач в работе` : "нет активных задач";

  return (
    <header className="dashboard-hero">
      <div className="dashboard-hero__content">
        <div className="dashboard-hero__intro">
          <span className="dashboard-pill">Центр загрузок</span>
          <h1>
            SpotiFLAC Control Hub — {runningCount}
            {" "}
            активных задач
          </h1>
          <p>
            Управляйте процессом скачивания, контролируйте очередь и обновляйте
            сетевые настройки в одном окне. Свежий дизайн подчёркивает главное и
            остаётся удобным даже на компактных экранах.
          </p>
          <div className="dashboard-meta">
            <span>{queueBadge}</span>
            <span>
              {lastHistoryUpdate
                ? `Последнее завершение: ${lastHistoryUpdate}`
                : "История ещё не формировалась"}
            </span>
          </div>
        </div>
        <div className="dashboard-hero__stats">
          {statCards.map((card) => (
            <article key={card.id} className={`metric-card ${card.accent}`}>
              <span className="metric-card__label">{card.label}</span>
              <strong>{card.value}</strong>
              <span className="metric-card__meta">{card.description}</span>
            </article>
          ))}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;

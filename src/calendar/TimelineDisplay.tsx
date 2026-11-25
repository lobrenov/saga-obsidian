import { useMemo, useState } from "react";
import type { Calendar } from "../shared/calendars/schema";
import { rendererDefs } from "../shared/renderers/definitions";
import { Chips } from "./Chips";
import { EntryCard } from "./EntryCard";
import { dateText } from "./entryDate";
import type { CalendarEntry } from "./entries";
import { Glyph } from "./Glyph";
import type { Selection } from "./MonthGrid";
import { NoteLink } from "./NoteLink";
import { opening } from "./opening";
import {
  axisFor,
  markOf,
  position,
  stepYear,
  titleOf,
  windowYears,
  yearsOf,
  type Axis,
  type Mark,
} from "./timelineAxis";
import { timelineRows, type TimelineRow } from "./timelineRows";
import type { CalendarState, Scale } from "./types";
import "./timeline.css";

type Ready = Extract<CalendarState, { kind: "calendar" }>;

const SCALES: { id: Scale; label: string }[] = [
  { id: "all", label: "All" },
  { id: "century", label: "Century" },
  { id: "decade", label: "Decade" },
  { id: "year", label: "Year" },
];
/** A date text flips to the left of its mark when the mark lies past this fraction of the axis and there is room before it; a mark wider than `INSIDE_AT` holds it. */
const FLIP_AT = 0.6;
const ROOM_AT = 0.25;
const INSIDE_AT = 0.6;

const percent = (fraction: number): string => `${(fraction * 100).toFixed(3)}%`;

/** The eras as one strip with a tick for each dated entry and a window over the range the chart shows. */
function Overview({
  calendar,
  axis,
  rows,
  shown,
  title,
}: {
  calendar: Calendar;
  axis: Axis;
  rows: readonly TimelineRow[];
  shown: Axis;
  title: string;
}) {
  const window = markOf(axis, shown.from, shown.to);
  return (
    <div
      className="saga-timeline-overview"
      role="img"
      aria-label={`Showing ${title} of ${calendar.eras.map((era) => era.name).join(", ")}`}
    >
      {axis.columns.map((column, i) => (
        <span
          key={i}
          className="saga-timeline-era"
          data-side={calendar.eras[i]?.side}
          ref={(el) =>
            el?.setCssProps({ "--saga-timeline-weight": String(column.weight) })
          }
        >
          <span className="saga-timeline-era-text">{column.label}</span>
        </span>
      ))}
      {rows
        .filter(
          (row) =>
            Number.isFinite(row.from) &&
            row.from >= axis.from &&
            row.from <= axis.to,
        )
        .map((row) => (
          <span
            key={row.entry.file.path}
            className="saga-timeline-tick"
            data-renderer={row.entry.renderer}
            ref={(el) =>
              el?.setCssProps({
                "--saga-timeline-left": percent(position(axis, row.from)),
              })
            }
          />
        ))}
      {window ? (
        <span
          className="saga-timeline-window"
          ref={(el) =>
            el?.setCssProps({
              "--saga-timeline-left": percent(window.left),
              "--saga-timeline-width": percent(window.right - window.left),
            })
          }
        />
      ) : null}
    </div>
  );
}

interface RowItemProps {
  calendar: Calendar;
  row: TimelineRow;
  mark: Mark;
  selected: Selection | null;
  onSelect: (entry: CalendarEntry, slot: string) => void;
}

/** One entry: its label, which opens the card, and its mark on the axis with the dates beside it. */
function RowItem({ calendar, row, mark, selected, onSelect }: RowItemProps) {
  const { entry } = row;
  const slot = `timeline|${entry.file.path}`;
  const middle = (mark.left + mark.right) / 2;
  const point = row.kind === "point";
  const inside = !point && mark.right - mark.left > INSIDE_AT;
  const flip =
    !inside &&
    (point ? middle : mark.right) > FLIP_AT &&
    (point ? middle : mark.left) > ROOM_AT;
  return (
    <li
      className="saga-timeline-row"
      data-renderer={entry.renderer}
      data-selected={selected?.path === entry.file.path || undefined}
    >
      <button
        type="button"
        className="saga-timeline-label"
        aria-haspopup="dialog"
        aria-expanded={selected?.slot === slot}
        data-slot={slot}
        onClick={() => onSelect(entry, slot)}
      >
        <Glyph name={rendererDefs[entry.renderer].icon} />
        <span className="saga-timeline-label-text">{entry.title}</span>
      </button>
      <div
        className="saga-timeline-track"
        data-opens-card=""
        onClick={() => onSelect(entry, slot)}
      >
        <span
          aria-hidden="true"
          className="saga-timeline-mark"
          data-kind={row.kind}
          data-open-start={mark.openStart || undefined}
          data-open-end={mark.openEnd || undefined}
          ref={(el) =>
            el?.setCssProps(
              row.kind === "point"
                ? { "--saga-timeline-left": percent(middle) }
                : {
                    "--saga-timeline-left": percent(mark.left),
                    "--saga-timeline-width": percent(mark.right - mark.left),
                  },
            )
          }
        />
        <span
          className="saga-timeline-when"
          data-flip={flip || undefined}
          data-inside={inside || undefined}
          ref={(el) =>
            el?.setCssProps({
              "--saga-timeline-left": percent(
                point ? middle : flip || inside ? mark.left : mark.right,
              ),
            })
          }
        >
          {dateText(calendar, entry, false)}
          {mark.openStart ? (
            <span className="saga-calview-sr">, continues before</span>
          ) : null}
          {mark.openEnd ? (
            <span className="saga-calview-sr">, continues after</span>
          ) : null}
        </span>
      </div>
    </li>
  );
}

/** The Timeline display: the window's title with the calendar's link, navigation and the Scale control, the era overview, the entries with a date problem, and one row per entry. */
export function TimelineDisplay({ state }: { state: Ready }) {
  const { calendar, entries, host, file } = state;
  // The scale the control chose, until the `scale` option shows it.
  const [pending, setPending] = useState<Scale | null>(null);
  const [at, setAt] = useState(() => opening(calendar, entries).year);
  const [selected, setSelected] = useState<Selection | null>(null);
  const scale = pending ?? state.scale;
  if (pending !== null && pending === state.scale) setPending(null);

  const { rows, unplaced } = useMemo(
    () => timelineRows(calendar, entries),
    [calendar, entries],
  );
  const years = useMemo(
    () => entries.flatMap(({ start, end }) => yearsOf(start, end)),
    [entries],
  );
  const axis = useMemo(
    () => axisFor(calendar, scale, at, years),
    [calendar, scale, at, years],
  );
  // Open-ended eras reach out to the window, so the overview always holds it.
  const overview = useMemo(
    () =>
      axisFor(
        calendar,
        "all",
        at,
        scale === "all" ? years : [...years, ...windowYears(scale, at)],
      ),
    [calendar, scale, at, years],
  );
  const shown = useMemo(
    () =>
      rows.flatMap((row) => {
        const mark = markOf(axis, row.from, row.to);
        return mark ? [{ row, mark }] : [];
      }),
    [rows, axis],
  );
  const card = selected
    ? entries.find((entry) => entry.file.path === selected.path)
    : undefined;
  const onSelect = (entry: CalendarEntry, slot: string): void =>
    setSelected(
      selected?.slot === slot ? null : { path: entry.file.path, slot },
    );
  const title = titleOf(calendar, scale, at);
  const unit = scale === "year" ? "year" : scale;

  const step = (n: number, from?: HTMLElement): void => {
    if (scale === "all") return;
    setAt((current) => stepYear(scale, current, n));
    setSelected(null);
    from?.focus();
  };
  const choose = (next: Scale): void => {
    setPending(next);
    setSelected(null);
    state.setOption("scale", next);
  };

  return (
    <div
      className="saga-calview-display"
      onKeyDown={(event) => {
        if (
          (event.key === "PageUp" || event.key === "PageDown") &&
          scale !== "all"
        ) {
          event.preventDefault();
          step(event.key === "PageUp" ? -1 : 1);
        } else if (event.key === "Escape" && selected) {
          event.stopPropagation();
          setSelected(null);
        }
      }}
    >
      <header className="saga-calview-header">
        <div className="saga-calview-heading">
          <h2 className="saga-calview-title">{title}</h2>
          <span className="saga-calview-on">
            on{" "}
            <NoteLink host={host} file={file}>
              {state.title}
            </NoteLink>
          </span>
        </div>
        {scale === "all" ? null : (
          <div className="saga-calview-nav">
            <button
              type="button"
              className="saga-calview-step"
              aria-label={`Previous ${unit}`}
              onClick={(event) => step(-1, event.currentTarget)}
            >
              <Glyph name="chevron-left" />
            </button>
            <button
              type="button"
              className="saga-calview-step"
              aria-label={`Next ${unit}`}
              onClick={(event) => step(1, event.currentTarget)}
            >
              <Glyph name="chevron-right" />
            </button>
          </div>
        )}
        <div role="group" aria-label="Scale" className="saga-calview-range">
          {SCALES.map(({ id: option, label }) => (
            <button
              key={option}
              type="button"
              aria-pressed={scale === option}
              onClick={() => choose(option)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="saga-calview-body">
        <div
          className="saga-calview-content saga-timeline"
          data-scale={scale}
          ref={(el) =>
            el?.setCssProps({
              "--saga-timeline-columns": String(axis.columns.length),
            })
          }
          onClick={(event) => {
            if (
              selected &&
              !(event.target as Element).closest(
                "[data-slot], .saga-timeline-track, .saga-calview-card",
              )
            )
              setSelected(null);
          }}
        >
          {scale !== "all" && calendar.eras.length > 0 ? (
            <Overview
              calendar={calendar}
              axis={overview}
              rows={rows}
              shown={axis}
              title={title}
            />
          ) : null}
          <Chips
            label="Date problem"
            items={unplaced.map((entry) => ({ entry, text: "" }))}
            selected={selected}
            onSelect={onSelect}
          />
          <div
            className="saga-timeline-scroll"
            role="region"
            aria-label="Timeline chart"
            tabIndex={0}
          >
            <div className="saga-timeline-chart">
              <div className="saga-timeline-grid" aria-hidden="true">
                {axis.columns.map((column, i) => (
                  <span
                    key={i}
                    className="saga-timeline-column"
                    ref={(el) =>
                      el?.setCssProps({
                        "--saga-timeline-weight": String(column.weight),
                      })
                    }
                  />
                ))}
              </div>
              <div className="saga-timeline-head" aria-hidden="true">
                <span className="saga-timeline-corner">Note</span>
                <div className="saga-timeline-columns">
                  {axis.columns.map((column, i) => (
                    <span
                      key={i}
                      className="saga-timeline-column-label"
                      ref={(el) =>
                        el?.setCssProps({
                          "--saga-timeline-weight": String(column.weight),
                        })
                      }
                    >
                      <span className="saga-timeline-column-text">
                        {column.label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              {shown.length > 0 ? (
                <ol className="saga-timeline-rows" aria-label="Timeline">
                  {shown.map(({ row, mark }) => (
                    <RowItem
                      key={row.entry.file.path}
                      calendar={calendar}
                      row={row}
                      mark={mark}
                      selected={selected}
                      onSelect={onSelect}
                    />
                  ))}
                </ol>
              ) : (
                <p className="saga-timeline-empty">
                  {rows.length === 0
                    ? `No dated notes on ${state.title}.`
                    : `Nothing is dated in ${title}.`}
                </p>
              )}
            </div>
          </div>
          {shown.length > 0 ? (
            <p className="saga-timeline-legend">
              <span>
                <span
                  aria-hidden="true"
                  className="saga-timeline-swatch"
                  data-kind="point"
                />
                Day
              </span>
              <span>
                <span
                  aria-hidden="true"
                  className="saga-timeline-swatch"
                  data-kind="bar"
                />
                Date to end date
              </span>
              <span>
                <span
                  aria-hidden="true"
                  className="saga-timeline-swatch"
                  data-kind="span"
                />
                Month, year or era (its whole length)
              </span>
            </p>
          ) : null}
          {card && selected ? (
            <EntryCard
              key={selected.slot}
              host={host}
              calendar={calendar}
              entry={card}
              slot={selected.slot}
              onClose={() => setSelected(null)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

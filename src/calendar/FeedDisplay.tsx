import { useId, useMemo, useRef, useState } from "react";
import { formatDate, type CalendarDate } from "../shared/calendars/dates";
import type { Calendar } from "../shared/calendars/schema";
import { Chips } from "./Chips";
import { EntryCard } from "./EntryCard";
import type { CalendarEntry } from "./entries";
import { buildFeed, type FeedEntry, type Order } from "./feed";
import type { CalendarHost } from "./host";
import type { Selection } from "./MonthGrid";
import { NoteLink } from "./NoteLink";
import type { CalendarState } from "./types";
import { useExcerpt } from "./useExcerpt";
import "./feed.css";

type Ready = Extract<CalendarState, { kind: "calendar" }>;

const EXCERPT_CHARS = 140;

const PRECISION_LABEL = {
  day: "Day",
  month: "Month",
  year: "Year",
  era: "Era",
} as const;

/** A date without its year, for an entry under a marker that gives the year; the month is also left out of an end in the start's month. */
function withinYear(
  calendar: Calendar,
  date: CalendarDate,
  year: number,
): string | undefined {
  if (
    !("year" in date) ||
    date.year !== year ||
    date.month === undefined ||
    date.day === undefined
  )
    return undefined;
  return `${date.day} ${calendar.months[date.month - 1]?.name ?? `Month ${date.month}`}`;
}

/** The date as the feed shows it; under a year marker a day date leaves out the year. */
function dateText(
  calendar: Calendar,
  { entry, start }: FeedEntry,
  under: number | undefined,
): string {
  const { end } = entry;
  const from =
    (under !== undefined && withinYear(calendar, start, under)) ||
    formatDate(calendar, start);
  if (!end) return from;
  if (
    under !== undefined &&
    "year" in start &&
    "year" in end &&
    start.month === end.month &&
    start.year === end.year &&
    start.day !== undefined &&
    end.day !== undefined &&
    withinYear(calendar, start, under)
  )
    return `${start.day} – ${withinYear(calendar, end, under)}`;
  return `${from} – ${(under !== undefined && withinYear(calendar, end, under)) || formatDate(calendar, end)}`;
}

/** The banner image at 96px, positioned by the note's `banner-y`; gone when the image fails to load. */
function Banner({ url, y }: NonNullable<CalendarEntry["banner"]>) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="saga-feed-banner">
      <img
        ref={(el) => el?.setCssProps({ "--saga-feed-banner-y": `${y}%` })}
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

interface FeedCardProps {
  calendar: Calendar;
  host: CalendarHost;
  item: FeedEntry;
  under: number | undefined;
  banners: boolean;
  /** The heading level of the title. */
  Title: "h2" | "h3";
}

/** The card of an entry: its banner, date, title as a link over the whole card, and an excerpt read as the card nears the viewport. */
function FeedCard({
  calendar,
  host,
  item,
  under,
  banners,
  Title,
}: FeedCardProps) {
  const { entry } = item;
  const id = useId();
  const excerptEl = useRef<HTMLParagraphElement>(null);
  const excerpt = useExcerpt(host, entry.file, EXCERPT_CHARS, excerptEl);
  return (
    <article
      className="saga-feed-card"
      aria-labelledby={id}
      data-renderer={entry.renderer}
      data-precision={item.precision}
    >
      {banners && entry.banner ? <Banner {...entry.banner} /> : null}
      <p className="saga-feed-date">
        {dateText(calendar, item, under)}
        {item.precision !== "day" ? (
          <span className="saga-feed-precision">
            {PRECISION_LABEL[item.precision]}
          </span>
        ) : null}
      </p>
      <Title id={id} className="saga-feed-title">
        <NoteLink host={host} file={entry.file}>
          {entry.title}
        </NoteLink>
      </Title>
      <p ref={excerptEl} className="saga-feed-excerpt">
        {excerpt}
      </p>
    </article>
  );
}

/** The Feed display: the calendar's link and the Order control above a central spine of entries, with era headers, gap and year markers. */
export function FeedDisplay({ state }: { state: Ready }) {
  const { calendar, entries, host, file } = state;
  // The order the control chose, until the `order` option shows it.
  const [pending, setPending] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const order = pending ?? state.order;
  if (pending !== null && pending === state.order) setPending(null);
  const { rows, problems } = useMemo(
    () => buildFeed(calendar, entries, order),
    [calendar, entries, order],
  );
  const card = selected
    ? entries.find((entry) => entry.file.path === selected.path)
    : undefined;
  // Entry titles sit one level below the era headers, or at the top level when there are none.
  const Title = rows.some((row) => row.kind === "era") ? "h3" : "h2";
  const choose = (next: Order): void => {
    setPending(next);
    state.setOption("feed-order", next);
  };
  const onSelect = (entry: CalendarEntry, slot: string): void =>
    setSelected(
      selected?.slot === slot ? null : { path: entry.file.path, slot },
    );

  return (
    <div
      className="saga-calview-display saga-feed"
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected) {
          event.stopPropagation();
          setSelected(null);
        }
      }}
    >
      <header className="saga-calview-header">
        <div className="saga-calview-heading">
          <span className="saga-calview-on">
            On{" "}
            <NoteLink host={host} file={file}>
              {state.title}
            </NoteLink>
          </span>
        </div>
        <div role="group" aria-label="Order" className="saga-calview-range">
          <button
            type="button"
            aria-pressed={order === "oldest"}
            onClick={() => choose("oldest")}
          >
            Oldest first
          </button>
          <button
            type="button"
            aria-pressed={order === "newest"}
            onClick={() => choose("newest")}
          >
            Newest first
          </button>
        </div>
      </header>
      <div className="saga-calview-body">
        <div
          className="saga-calview-content"
          onClick={(event) => {
            if (
              selected &&
              !(event.target as Element).closest(
                "[data-slot], .saga-calview-card",
              )
            )
              setSelected(null);
          }}
        >
          <Chips
            label="Date problem"
            items={problems.map((entry) => ({ entry, text: "" }))}
            selected={selected}
            onSelect={onSelect}
          />
          {rows.length === 0 ? (
            problems.length === 0 ? (
              <p className="saga-calview-state">
                No dated notes on {state.title}.
              </p>
            ) : null
          ) : (
            <ol className="saga-feed-list" aria-label="Feed">
              {rows.map((row, index) => {
                if (row.kind === "era")
                  return (
                    <li
                      key={`era-${index}`}
                      className="saga-feed-row saga-feed-marker"
                    >
                      <h2 className="saga-feed-era">
                        {row.era.name}{" "}
                        <span className="saga-feed-short">{row.era.short}</span>
                      </h2>
                    </li>
                  );
                if (row.kind === "gap")
                  return (
                    <li
                      key={`gap-${index}`}
                      className="saga-feed-row saga-feed-marker saga-feed-gap"
                    >
                      <span>
                        {row.years === 1
                          ? "1 year"
                          : `${row.years.toLocaleString()} years`}
                      </span>
                    </li>
                  );
                if (row.kind === "year")
                  return (
                    <li
                      key={`year-${index}`}
                      className="saga-feed-row saga-feed-marker"
                    >
                      <p className="saga-feed-year">
                        {formatDate(calendar, { year: row.year })}
                      </p>
                    </li>
                  );
                return (
                  <li
                    key={row.item.entry.file.path}
                    className="saga-feed-row saga-feed-entry"
                    data-side={row.side}
                  >
                    <FeedCard
                      calendar={calendar}
                      host={host}
                      item={row.item}
                      under={row.under}
                      banners={state.banners}
                      Title={Title}
                    />
                    <span
                      aria-hidden="true"
                      className="saga-feed-node"
                      data-renderer={row.item.entry.renderer}
                      data-precision={row.item.precision}
                    />
                  </li>
                );
              })}
            </ol>
          )}
          {rows.length > 0 ? (
            <p className="saga-feed-legend">
              <span>
                <span
                  aria-hidden="true"
                  className="saga-feed-node"
                  data-precision="day"
                />
                Day
              </span>
              <span>
                <span
                  aria-hidden="true"
                  className="saga-feed-node"
                  data-precision="month"
                />
                Month or year
              </span>
              <span>
                <span
                  aria-hidden="true"
                  className="saga-feed-node"
                  data-precision="era"
                />
                Era
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

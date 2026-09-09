"use client";

import { useCallback, useState } from "react";
import type { OrderDetail, OrderItemRow } from "@/server/data-access/pos";

/**
 * ESC/POS raw spooler over WebUSB (Chrome/Edge), for 80mm thermal printers.
 * Falls back to window.print() when WebUSB is unavailable. Ported from the
 * old system's src/hooks/useThermalPrint.ts, adapted to this project's
 * order/item shape (no order_number column here — tickets are headed by
 * table name and a short order reference instead).
 */

const ESC = 0x1b;
const GS = 0x1d;

function encode(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function line(char = "-", width = 48): number[] {
  return encode(char.repeat(width) + "\n");
}

function money(value: number): string {
  return value.toFixed(2);
}

function row(left: string, right: string, width = 48): number[] {
  const space = Math.max(1, width - left.length - right.length);
  return encode(left + " ".repeat(Math.max(1, space)) + right + "\n");
}

function shortRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

/** Kitchen or bar ticket — only the given items, no prices. Caller pre-splits
 * items by station (kitchen vs bar) before calling this. */
export function buildStationTicket(order: OrderDetail, items: OrderItemRow[], station: "kitchen" | "bar"): Uint8Array {
  const bytes: number[] = [];
  const heading = station === "bar" ? "*** BAR ***" : "*** KOT ***";

  bytes.push(ESC, 0x40);
  bytes.push(ESC, 0x61, 0x01);
  bytes.push(ESC, 0x21, 0x30);
  bytes.push(...encode(`${heading}\n`));
  bytes.push(ESC, 0x21, 0x00);
  bytes.push(...line("="));

  bytes.push(ESC, 0x61, 0x00);
  bytes.push(...row(`Order #${shortRef(order.id)}`, order.channel_type.replace("_", " ").toUpperCase()));
  if (order.table) bytes.push(...row("Table", order.table.name));
  bytes.push(...row("Time", new Date().toLocaleTimeString("en-GB")));
  bytes.push(...line());

  bytes.push(ESC, 0x21, 0x10);
  for (const item of items) {
    const name = item.is_custom ? (item.custom_description ?? "Item") : (item.menu_item?.name ?? "Item");
    bytes.push(...encode(`${item.quantity} x ${name}\n`));
  }
  bytes.push(ESC, 0x21, 0x00);

  bytes.push(...line("="));
  bytes.push(ESC, 0x61, 0x01);
  bytes.push(...encode(`${items.length} item(s) — fire now\n\n`));
  bytes.push(GS, 0x56, 0x42, 0x10);

  return new Uint8Array(bytes);
}

/** Full bill/receipt — line items with prices, subtotal, service charge, total. */
export function buildBillReceipt(order: OrderDetail, hotelName = "Hotel Rawana"): Uint8Array {
  const bytes: number[] = [];

  bytes.push(ESC, 0x40);
  bytes.push(ESC, 0x61, 0x01);
  bytes.push(ESC, 0x21, 0x30);
  bytes.push(...encode(`${hotelName}\n`));
  bytes.push(ESC, 0x21, 0x00);
  bytes.push(...encode("Restaurant Bill\n"));
  bytes.push(...line("="));

  bytes.push(ESC, 0x61, 0x00);
  bytes.push(...row(`Bill #${shortRef(order.id)}`, order.channel_type.replace("_", " ").toUpperCase()));
  bytes.push(...row("Date", new Date(order.created_at).toLocaleString("en-GB")));
  if (order.table) bytes.push(...row("Table", order.table.name));
  bytes.push(...line());

  for (const item of order.items) {
    const name = item.is_custom ? (item.custom_description ?? "Item") : (item.menu_item?.name ?? "Item");
    bytes.push(...encode(`${name}\n`));
    bytes.push(...row(`  ${item.quantity} x ${money(Number(item.unit_price))}`, money(Number(item.line_total))));
  }

  bytes.push(...line());
  const subtotal = Number(order.subtotal || order.total_amount);
  const serviceCharge = Number(order.service_charge || 0);
  if (serviceCharge > 0) {
    const pct = subtotal > 0 ? Math.round((serviceCharge / subtotal) * 100) : 0;
    bytes.push(...row("Subtotal", money(subtotal)));
    bytes.push(...row(`Service charge ${pct}%`, money(serviceCharge)));
    bytes.push(...line());
  }
  bytes.push(ESC, 0x21, 0x10);
  bytes.push(...row("TOTAL (LKR)", money(Number(order.total_amount))));
  bytes.push(ESC, 0x21, 0x00);
  bytes.push(...line("="));

  bytes.push(ESC, 0x61, 0x01);
  bytes.push(...encode("Thank you — come again!\n\n"));
  bytes.push(GS, 0x56, 0x42, 0x10);

  return new Uint8Array(bytes);
}

interface UseThermalPrintResult {
  printStationTicket: (order: OrderDetail, items: OrderItemRow[], station: "kitchen" | "bar") => Promise<boolean>;
  printBill: (order: OrderDetail) => Promise<boolean>;
  printing: boolean;
  error: string | null;
}

export function useThermalPrint(): UseThermalPrintResult {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spool = useCallback(async (data: Uint8Array): Promise<boolean> => {
    setPrinting(true);
    setError(null);
    try {
      const nav = navigator as Navigator & {
        usb?: {
          getDevices: () => Promise<USBLikeDevice[]>;
          requestDevice: (opts: { filters: { classCode: number }[] }) => Promise<USBLikeDevice>;
        };
      };

      if (!nav.usb) {
        window.print();
        return true;
      }

      const known = await nav.usb.getDevices();
      const device = known[0] ?? (await nav.usb.requestDevice({ filters: [{ classCode: 7 }] }));

      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);

      const iface = device.configuration?.interfaces[0];
      const endpoint = iface?.alternate.endpoints.find((e) => e.direction === "out")?.endpointNumber ?? 1;

      await device.transferOut(endpoint, data);
      await device.close();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Printer connection failed");
      return false;
    } finally {
      setPrinting(false);
    }
  }, []);

  const printStationTicket = useCallback(
    (order: OrderDetail, items: OrderItemRow[], station: "kitchen" | "bar") =>
      spool(buildStationTicket(order, items, station)),
    [spool]
  );

  const printBill = useCallback((order: OrderDetail) => spool(buildBillReceipt(order)), [spool]);

  return { printStationTicket, printBill, printing, error };
}

interface USBLikeDevice {
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (n: number) => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  transferOut: (endpoint: number, data: Uint8Array) => Promise<unknown>;
  configuration: {
    interfaces: {
      alternate: { endpoints: { direction: string; endpointNumber: number }[] };
    }[];
  } | null;
}

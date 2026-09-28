import CoreFeature from "../../core/CoreFeature.js";
import Range from "./Range.js";
import Rect from "../../core/tools/Rect.js";

export default class FillHandle extends CoreFeature {
	constructor(table, rangeManager) {
		super(table);

		/** @type {import("./SelectRange.js").default} */
		this.rangeManager = rangeManager;
		this.element = null;
		/** @type {Range|null} */
		this.preview = null;
		/** @type {Rect|null} */
		this.source = null;
		this.pointerRow = 0;
		this.pointerCol = 0;
		this.isActive = false;

		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);
		this.handleCellMouseMove = this.handleCellMouseMove.bind(this);

		this.element = document.createElement("div");
		this.element.classList.add("tabulator-range-fill-handle");
		this.element.addEventListener("mousedown", this.handleMouseDown);

		this.subscribe("range-active-changed", (range) => this.attach(range));
	}

	attach(range) {
		if (this.element.parentNode !== range.element) {
			range.element.appendChild(this.element);
		}
	}

	handleMouseDown(e) {
		const range = this.rangeManager.activeRange;

		if (e.button !== 0 || !range) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		this.isActive = true;
		this.source = range.rect.clone();
		this.pointerRow = this.source.bottom;
		this.pointerCol = this.source.right;

		this.preview = new Range(this.table, this.rangeManager, {
			rect: this.source,
			skipEvents: true,
			classNames: ["tabulator-range-fill-preview"],
		});

		this.rangeManager.rangeContainer.appendChild(this.preview.element);
		this.preview.layout();
		this.subscribe("cell-mousemove", this.handleCellMouseMove);
		document.addEventListener("mouseup", this.handleMouseUp);
	}

	handleCellMouseMove(e, cell) {
		if (cell.column === this.rangeManager.rowHeader) {
			return;
		}

		this.pointerRow = cell.row.position - 1;
		this.pointerCol = cell.column.getPosition() - 1;

		const rect = FillHandle.extendAlongAxis(
			this.source,
			this.pointerRow,
			this.pointerCol,
		);

		this.preview.setRect(rect);
		this.preview.layout();
	}

	handleMouseUp() {
		this.isActive = false;

		this.unsubscribe("cell-mousemove", this.handleCellMouseMove);
		document.removeEventListener("mouseup", this.handleMouseUp);

		this.preview.destroy();

		this.fill(this.source, this.pointerRow, this.pointerCol);

		this.rangeManager.setActiveRangeRect(this.preview.rect);
	}

	/**
	 * Fills the cells a drag from `source` to (pointerRow, pointerCol) covers,
	 * repeating the source's values.
	 * @param {Rect} source
	 * @param {number} pointerRow
	 * @param {number} pointerCol
	 */
	fill(source, pointerRow, pointerCol) {
		const target = FillHandle.extendAlongAxis(source, pointerRow, pointerCol);
		const height = source.bottom - source.top + 1;
		const width = source.right - source.left + 1;

		if (target.equals(source)) {
			return;
		}

		this.table.blockRedraw();

		const rows = this.rangeManager.getTableRows();
		const columns = this.rangeManager.getTableColumns();
		const rowUpdates = new Map();

		target.forEach((x, y) => {
			if (source.hasPoint(x, y)) {
				return;
			}

			const row = rows[y];
			const column = columns[x];
			const cell = row.getCell(column);

			if (cell && this.table.modules.edit?.allowEdit(cell)) {
				const sourceRowPos =
					source.top + ((((y - source.top) % height) + height) % height);
				const sourceColPos =
					source.left + ((((x - source.left) % width) + width) % width);
				const sourceRow = rows[sourceRowPos];
				const sourceCol = columns[sourceColPos];

				if (!rowUpdates.has(row)) {
					// Save old data so we can undo it
					rowUpdates.set(row, { row, oldData: {}, newData: {} });
				}

				const update = rowUpdates.get(row);

				update.oldData[column.getField()] = cell.getValue();
				update.newData[column.getField()] =
					sourceRow.getData()[sourceCol.getField()];
			}
		});

		rowUpdates.forEach(({ row, newData }) => row.updateData(newData));

		if (rowUpdates.size && this.table.modExists("history")) {
			this.table.modules.history.action("rangeFill", this.rangeManager.activeRange, {
				rows: [...rowUpdates.values()],
			});
		}

		this.table.restoreRedraw();
	}

	/**
	 * The rect a fill from `source` covers when the pointer is over (row, col).
	 * @param {Rect} source
	 * @param {number} row
	 * @param {number} col
	 */
	static extendAlongAxis(source, row, col) {
		let rowDelta = 0;
		let colDelta = 0;
		let top = source.top;
		let bottom = source.bottom;
		let left = source.left;
		let right = source.right;

		if (row < source.top) {
			rowDelta = source.top - row;
		} else if (row > source.bottom) {
			rowDelta = row - source.bottom;
		}

		if (col < source.left) {
			colDelta = source.left - col;
		} else if (col > source.right) {
			colDelta = col - source.right;
		}

		// Like a spreadsheet, a fill only ever grows along one axis: whichever the pointer has strayed further on.
		if (rowDelta && rowDelta >= colDelta) {
			top = Math.min(top, row);
			bottom = Math.max(bottom, row);
		} else if (colDelta) {
			left = Math.min(left, col);
			right = Math.max(right, col);
		}

		return new Rect(top, bottom, left, right);
	}

	destroy() {
		document.removeEventListener("mouseup", this.handleMouseUp);
		this.element.remove();
		this.preview?.destroy();
	}
}

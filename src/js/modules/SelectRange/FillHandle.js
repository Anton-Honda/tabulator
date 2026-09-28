import CoreFeature from '../../core/CoreFeature.js';
import Helpers from '../../core/tools/Helpers.js';

export default class FillHandle extends CoreFeature{
	constructor(table, rangeManager) {
		super(table);

		/** @type {import("./SelectRange.js").default} */
		this.rangeManager = rangeManager;
		this.element = null;
		this.source = null;

		this.mouseDownEvent = this._handleMouseDown.bind(this);
		this.mouseUpEvent = this._handleMouseUp.bind(this);

		this.initElement();
		
		this.subscribe("range-active-changed", this.attach.bind(this));
		this.subscribe("cell-mousemove", this._handleCellMouseMove.bind(this));
	}

	initElement() {
		this.element = document.createElement("div");
		this.element.classList.add("tabulator-range-fill-handle");
		this.element.addEventListener("mousedown", this.mouseDownEvent);
	}

	attach(range) {
		if (this.element.parentNode !== range.element) {
			range.element.appendChild(this.element);
		}
	}

	isDragging() {
		return !!this.source;
	}

	///////////////////////////////////
	////////// Event Handlers /////////
	///////////////////////////////////

	_handleMouseDown(e) {
		const range = this.rangeManager.activeRange;

		if (e.button !== 0 || !range) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		this.source = {
			start:{row:range.start.row, col:range.start.col},
			top:range.top,
			bottom:range.bottom,
			left:range.left,
			right:range.right,
		};

		document.addEventListener("mouseup", this.mouseUpEvent);
	}

	_handleCellMouseMove(e, cell) {
		if (this.isDragging()) {
			this.preview(cell);
		}
	}
	
	_handleMouseUp() {
		const source = this.source;

		document.removeEventListener("mouseup", this.mouseUpEvent);
		this.source = null;

		if (source) {
			this.fill(source, this.rangeManager.activeRange);
		}
	}

	///////////////////////////////////
	///////        Fill         ///////
	///////////////////////////////////

	preview(cell) {
		if (cell.column === this.rangeManager.rowHeader) {
			return;
		}

		const source = this.source;
		const range = this.rangeManager.activeRange;
		const row = cell.row.position - 1;
		const col = cell.column.getPosition() - 1;
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

		const startRow = source.start.row === source.top ? top : bottom;
		const startCol = source.start.col === source.left ? left : right;

		range.setStart(startRow, startCol);
		range.setEnd(startRow === top ? bottom : top, startCol === left ? right : left);

		this.rangeManager.layoutElement(true);
	}

	fill(source, range) {
		const height = source.bottom - source.top + 1;
		const width = source.right - source.left + 1;

		if (range.top === source.top && range.bottom === source.bottom && range.left === source.left && range.right === source.right) {
			return;
		}

		this.table.blockRedraw();

		const rows = this.rangeManager.getTableRows();
		const columns = this.rangeManager.getTableColumns();
		const updates = new Map();

		for (let r = range.top; r <= range.bottom; r++) {
			for (let c = range.left; c <= range.right; c++) {
				const insideSource = r >= source.top && r <= source.bottom && c >= source.left && c <= source.right;

				if (insideSource) {
					continue;
				}

				const row = rows[r];
				const column = columns[c];
				const cell = row.getCell(column);

				if (cell && this.table.modules.edit?.allowEdit(cell)) {
					const sourceRow = source.top + (((r - source.top) % height) + height) % height;
					const sourceCol = source.left + (((c - source.left) % width) + width) % width;

					if (!updates.has(row)) {
						updates.set(row, {row, oldData:{}, newData:{}});
					}

					const update = updates.get(row);

					this.seedNestedField(update.oldData, row, column);
					this.seedNestedField(update.newData, row, column);

					column.setFieldValue(update.oldData, cell.getValue());
					column.setFieldValue(update.newData, columns[sourceCol].getFieldValue(rows[sourceRow].getData()));
				}
			}
		}

		updates.forEach(({row, newData}) => {
			row.updateData(newData);
		});

		if (updates.size && this.table.options.history && this.table.modExists("history")) {
			this.table.modules.history.action("rangeFill", range, {rows:[...updates.values()]});
		}

		this.table.restoreRedraw();
	}

	// A row update replaces whole top-level values, so a nested field must carry its siblings along.
	seedNestedField(data, row, column) {
		const root = column.fieldStructure[0];

		if (column.fieldStructure.length > 1 && !(root in data)) {
			data[root] = Helpers.deepClone(row.getData()[root]);
		}
	}

	destroy() {
		document.removeEventListener("mouseup", this.mouseUpEvent);
		this.element.remove();
	}
}

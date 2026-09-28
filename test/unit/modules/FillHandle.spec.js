import FillHandle from "../../../src/js/modules/SelectRange/FillHandle";
import Rect from "../../../src/js/core/tools/Rect";

class FakeColumn {
	constructor(field, editable) {
		this.field = field;
		this.editable = editable;
	}

	getField() {
		return this.field;
	}
}

class FakeCell {
	constructor(row, column) {
		this.row = row;
		this.column = column;
	}

	getValue() {
		return this.row.data[this.column.field];
	}
}

class FakeRow {
	constructor(data) {
		this.data = data;
	}

	getCell(column) {
		return new FakeCell(this, column);
	}

	getData() {
		return this.data;
	}

	updateData(newData) {
		Object.assign(this.data, newData);
	}
}

function createFillHandle() {
	const rows = [
		new FakeRow({ id: 1, name: "A", age: 1 }),
		new FakeRow({ id: 2, name: "B", age: 2 }),
		new FakeRow({ id: 3, name: "C", age: 3 }),
		new FakeRow({ id: 4, name: "D", age: 4 }),
		new FakeRow({ id: 5, name: "E", age: 5 }),
	];
	const columns = [
		new FakeColumn("id", false),
		new FakeColumn("name", true),
		new FakeColumn("age", true),
	];

	const table = {
		eventBus: { subscribe: jest.fn() },
		blockRedraw: jest.fn(),
		restoreRedraw: jest.fn(),
		modules: {
			edit: { allowEdit: jest.fn((cell) => cell.column.editable) },
			history: { action: jest.fn() },
		},
		modExists: jest.fn((name) => name === "history"),
	};

	const rangeManager = {
		getTableRows: jest.fn(() => rows),
		getTableColumns: jest.fn(() => columns),
	};

	return new FillHandle(table, rangeManager);
}

function columnValues(fillHandle, field) {
	return fillHandle.rangeManager.getTableRows().map((row) => row.data[field]);
}

describe("FillHandle", () => {
	// Source for the extendAlongAxis tests: rows 2-3, columns 2-3.
	const source = new Rect(2, 3, 2, 3);

	test("extendAlongAxis stays the source when the pointer is inside it", () => {
		expect(FillHandle.extendAlongAxis(source, 3, 2)).toEqual(
			new Rect(2, 3, 2, 3),
		);
	});

	test("extendAlongAxis grows down to the pointer row", () => {
		expect(FillHandle.extendAlongAxis(source, 6, 3)).toEqual(
			new Rect(2, 6, 2, 3),
		);
	});

	test("extendAlongAxis grows up to the pointer row", () => {
		expect(FillHandle.extendAlongAxis(source, 0, 2)).toEqual(
			new Rect(0, 3, 2, 3),
		);
	});

	test("extendAlongAxis grows right to the pointer column", () => {
		expect(FillHandle.extendAlongAxis(source, 2, 5)).toEqual(
			new Rect(2, 3, 2, 5),
		);
	});

	test("extendAlongAxis grows left to the pointer column", () => {
		expect(FillHandle.extendAlongAxis(source, 3, 0)).toEqual(
			new Rect(2, 3, 0, 3),
		);
	});

	test("extendAlongAxis grows only along rows when the pointer is further out by row", () => {
		expect(FillHandle.extendAlongAxis(source, 6, 5)).toEqual(
			new Rect(2, 6, 2, 3),
		);
	});

	test("extendAlongAxis grows only along columns when the pointer is further out by column", () => {
		expect(FillHandle.extendAlongAxis(source, 4, 7)).toEqual(
			new Rect(2, 3, 2, 7),
		);
	});

	test("extendAlongAxis prefers rows when the pointer is equally far out on both axes", () => {
		expect(FillHandle.extendAlongAxis(source, 5, 5)).toEqual(
			new Rect(2, 5, 2, 3),
		);
	});

	test("copies the source value into every target cell", () => {
		const fillHandle = createFillHandle();

		fillHandle.fill(new Rect(1, 1, 1, 1), 3, 1);

		expect(columnValues(fillHandle, "name")).toEqual(["A", "B", "B", "B", "E"]);
	});

	test("repeats a multi-cell selection when filling upwards, continuing the pattern backwards", () => {
		const fillHandle = createFillHandle();

		fillHandle.fill(new Rect(3, 4, 2, 2), 0, 2);

		expect(columnValues(fillHandle, "age")).toEqual([5, 4, 5, 4, 5]);
	});

	test("records the whole fill as a single history action", () => {
		const fillHandle = createFillHandle();

		fillHandle.fill(new Rect(0, 0, 1, 1), 2, 1);

		const action = fillHandle.table.modules.history.action;
		expect(action).toHaveBeenCalledTimes(1);
		expect(action.mock.calls[0][0]).toBe("rangeFill");
	});

	test("leaves cells in non-editable columns untouched", () => {
		const fillHandle = createFillHandle();

		fillHandle.fill(new Rect(0, 0, 0, 0), 2, 0);

		expect(columnValues(fillHandle, "id")).toEqual([1, 2, 3, 4, 5]);
	});
});

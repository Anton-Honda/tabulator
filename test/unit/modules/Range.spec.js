import TabulatorFull from "../../../src/js/core/TabulatorFull.js";

describe("Range.setData", () => {
	let table;
	let range;

	beforeEach(async () => {
		document.body.innerHTML = "<div id=\"test-table\"></div>";

		table = new TabulatorFull("#test-table", {
			selectableRange: 1,
			history: true,
			columns: [
				{ field: "name", editor: "input" },
				{ field: "age", editor: "number" },
			],
			data: [
				{ name: "A", age: 1 },
				{ name: "B", age: 2 },
			],
		});

		await new Promise((resolve) => table.on("tableBuilt", resolve));

		const rows = table.getRows();
		table.addRange(rows[0].getCell("name"), rows[1].getCell("age"));
		// addRange sets its bounds in a setTimeout
		await new Promise((resolve) => setTimeout(resolve));

		range = table.getRanges()[0];
	});

	afterEach(() => {
		table.destroy();
	});

	test("sets values by position and leaves cells past a short row untouched", () => {
		range.setData([["X"], ["B", 9]]);

		expect(table.getData()).toEqual([
			{ name: "X", age: 1 },
			{ name: "B", age: 9 },
		]);
	});

	test("records one history action that undoes every cell", () => {
		range.setData([["X", 8], ["Y", 9]]);

		expect(table.getHistoryUndoSize()).toBe(1);

		table.undo();
		expect(table.getData()).toEqual([
			{ name: "A", age: 1 },
			{ name: "B", age: 2 },
		]);

		table.redo();
		expect(table.getData()).toEqual([
			{ name: "X", age: 8 },
			{ name: "Y", age: 9 },
		]);
	});

	test("dispatches rangeEdited once when something changes", () => {
		const rangeEdited = jest.fn();
		table.on("rangeEdited", rangeEdited);

		range.setData([["X"], ["Y"]]);

		expect(rangeEdited).toHaveBeenCalledTimes(1);
	});

	test("dispatches rangeEdited with the range component and the changed cells", () => {
		const rangeEdited = jest.fn();
		table.on("rangeEdited", rangeEdited);

		range.setData([["X", 8], ["Y", 9]]);

		const [rangeComponent, changedCells] = rangeEdited.mock.calls[0];

		expect(rangeComponent).toBe(table.getRanges()[0]);
		expect(changedCells.map((cell) => [cell.getField(), cell.getValue()])).toEqual([
			["name", "X"],
			["age", 8],
			["name", "Y"],
			["age", 9],
		]);
	});

	test("rangeEdited only reports the cells whose value actually changed", () => {
		const rangeEdited = jest.fn();
		table.on("rangeEdited", rangeEdited);

		// "A" and 2 match the existing values, so only two cells change
		range.setData([["A", 8], ["Y", 2]]);

		const changedCells = rangeEdited.mock.calls[0][1];

		expect(changedCells.map((cell) => [cell.getField(), cell.getValue()])).toEqual([
			["age", 8],
			["name", "Y"],
		]);
	});

	test("rangeEdited omits cells past a short row and non-editable cells", () => {
		// What `editable: false` on the column definition compiles to
		table.columnManager.getColumnByField("age").modules.edit.check = false;

		const rangeEdited = jest.fn();
		table.on("rangeEdited", rangeEdited);

		range.setData([["X"], ["Y", 9]]);

		const changedCells = rangeEdited.mock.calls[0][1];

		expect(changedCells.map((cell) => [cell.getField(), cell.getValue()])).toEqual([
			["name", "X"],
			["name", "Y"],
		]);
	});

	test("records no history and dispatches no rangeEdited when nothing changes", () => {
		const rangeEdited = jest.fn();
		table.on("rangeEdited", rangeEdited);

		range.setData([["A"], []]);

		expect(table.getHistoryUndoSize()).toBe(0);
		expect(rangeEdited).not.toHaveBeenCalled();
	});

	test("skips non-editable cells", () => {
		// What `editable: false` on the column definition compiles to
		table.columnManager.getColumnByField("age").modules.edit.check = false;

		range.setData([["X", 8], ["Y", 9]]);

		expect(table.getData()).toEqual([
			{ name: "X", age: 1 },
			{ name: "Y", age: 2 },
		]);
	});
});

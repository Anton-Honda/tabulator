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

	test("sets the given fields and leaves the others untouched", () => {
		range.setData([{ name: "X" }, { age: 9 }]);

		expect(table.getData()).toEqual([
			{ name: "X", age: 1 },
			{ name: "B", age: 9 },
		]);
	});

	test("records one history action that undoes every cell", () => {
		range.setData([{ name: "X", age: 8 }, { name: "Y", age: 9 }]);

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

		range.setData([{ name: "X" }, { name: "Y" }]);

		expect(rangeEdited).toHaveBeenCalledTimes(1);
	});

	test("records no history and dispatches no rangeEdited when nothing changes", () => {
		const rangeEdited = jest.fn();
		table.on("rangeEdited", rangeEdited);

		range.setData([{ name: "A" }, {}]);

		expect(table.getHistoryUndoSize()).toBe(0);
		expect(rangeEdited).not.toHaveBeenCalled();
	});
});

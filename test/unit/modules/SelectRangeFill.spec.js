import TabulatorFull from "../../../src/js/core/TabulatorFull";

describe("SelectRange fill handle", () => {
    /** @type {TabulatorFull} */
    let tabulator;
    let selectRangeMod;
    let offsetSpies;

    beforeAll(() => {
        // jsdom computes no layout, so without this the table body is never attached and mouse events never reach it
        offsetSpies = [
            jest.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(30),
            jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100),
        ];
    });

    afterAll(() => {
        offsetSpies.forEach((spy) => spy.mockRestore());
    });

    beforeEach(async () => {
        const el = document.createElement("div");
        el.id = "select-range-fill-test";
        document.body.appendChild(el);
        tabulator = new TabulatorFull("#select-range-fill-test", {
            data: [
                { id: 1, name: "A", age: 1, address: { city: "c1", zip: "z1" } },
                { id: 2, name: "B", age: 2, address: { city: "c2", zip: "z2" } },
                { id: 3, name: "C", age: 3, address: { city: "c3", zip: "z3" } },
                { id: 4, name: "D", age: 4, address: { city: "c4", zip: "z4" } },
                { id: 5, name: "E", age: 5, address: { city: "c5", zip: "z5" } },
            ],
            columns: [
                { title: "ID", field: "id" },
                { title: "Name", field: "name", editor: "input" },
                { title: "Age", field: "age", editor: "number" },
                { title: "City", field: "address.city", editor: "input" },
            ],
            selectableRange: true,
            selectableRangeFill: true,
            history: true,
            renderVertical: "basic",
        });
        selectRangeMod = tabulator.module("selectRange");

        return new Promise((resolve) => {
            tabulator.on("renderComplete", () => {
                resolve();
            });
        });
    });

    afterEach(() => {
        tabulator.destroy();
        document.getElementById("select-range-fill-test")?.remove();
    });

    function cell(row, col) {
        return tabulator.getRows()[row].getCells()[col];
    }

    function select(start, end) {
        selectRangeMod.resetRanges().setBounds(start._cell, end._cell);
    }

    function dragHandleTo(target) {
        const handle = tabulator.element.querySelector(".tabulator-range-fill-handle");
        handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
        target.getElement().dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }

    function column(field) {
        return tabulator.getData().map((row) => row[field]);
    }

    it("fills the cells dragged over with the selected cell's value", () => {
        select(cell(1, 1), cell(1, 1));

        dragHandleTo(cell(3, 1));

        expect(column("name")).toEqual(["A", "B", "B", "B", "E"]);
    });

    it("repeats a multi-cell selection when filling upwards, continuing the pattern backwards", () => {
        select(cell(3, 2), cell(4, 2));

        dragHandleTo(cell(0, 2));

        expect(column("age")).toEqual([5, 4, 5, 4, 5]);
    });

    it("only grows along the axis the pointer moved furthest on", () => {
        select(cell(0, 1), cell(0, 1));

        dragHandleTo(cell(3, 2));

        expect(column("name")).toEqual(["A", "A", "A", "A", "E"]);
        expect(column("age")).toEqual([1, 2, 3, 4, 5]);
    });

    it("undoes and redoes a whole fill as a single history step", () => {
        select(cell(0, 1), cell(0, 1));

        dragHandleTo(cell(2, 1));

        expect(tabulator.getHistoryUndoSize()).toBe(1);

        tabulator.undo();
        expect(column("name")).toEqual(["A", "B", "C", "D", "E"]);

        tabulator.redo();
        expect(column("name")).toEqual(["A", "A", "A", "D", "E"]);
    });

    it("keeps the other fields of a nested object when filling one of them", () => {
        select(cell(0, 3), cell(0, 3));

        dragHandleTo(cell(1, 3));

        expect(tabulator.getData()[1].address).toEqual({ city: "c1", zip: "z2" });

        tabulator.undo();
        expect(tabulator.getData()[1].address).toEqual({ city: "c2", zip: "z2" });
    });

    it("leaves cells in non-editable columns untouched", () => {
        select(cell(0, 2), cell(0, 2));

        dragHandleTo(cell(0, 0));

        expect(column("id")).toEqual([1, 2, 3, 4, 5]);
        expect(column("name")[0]).toBe(1);
    });
});

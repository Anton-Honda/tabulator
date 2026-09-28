export default {
	rangeFill:function(action){
		action.data.rows.forEach(({row, newData}) => {
			if(this.table.rowManager.rows.includes(row)){
				row.updateData(newData);
			}
		});
	},
};

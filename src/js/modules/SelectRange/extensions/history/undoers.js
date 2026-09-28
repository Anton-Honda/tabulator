export default {
	rangeFill:function(action){
		action.data.rows.forEach(({row, oldData}) => {
			if(this.table.rowManager.rows.includes(row)){
				row.updateData(oldData);
			}
		});
	},
};

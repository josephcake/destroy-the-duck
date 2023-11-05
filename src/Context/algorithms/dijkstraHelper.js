export const dijkstraHelper = (starting, ending) => {
	function dijkstra(grid, start, end) {
		const rows = grid.length;
		const cols = grid[0].length;
		const dist = Array(rows)
			.fill()
			.map(() => Array(cols).fill(Infinity));
		const visited = Array(rows)
			.fill()
			.map(() => Array(cols).fill(false));
		const prev = Array(rows)
			.fill()
			.map(() => Array(cols).fill(null));

		const [startRow, startCol] = start;
		const [endRow, endCol] = end;
		dist[startRow][startCol] = 0;

		for (let i = 0; i < rows * cols; i++) {
			let minDist = Infinity;
			let minRow = -1;
			let minCol = -1;

			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					if (!visited[r][c] && dist[r][c] < minDist) {
						minDist = dist[r][c];
						minRow = r;
						minCol = c;
					}
				}
			}

			if (minRow === -1 || minCol === -1) {
				break;
			}

			visited[minRow][minCol] = true;

			// Visit neighbors
			const neighbors = [
				[minRow - 1, minCol],
				[minRow + 1, minCol],
				[minRow, minCol - 1],
				[minRow, minCol + 1],
			];

			for (let [r, c] of neighbors) {
				if (r < 0 || r >= rows || c < 0 || c >= cols) {
					continue;
				}

				const weight = grid[r][c];
				const distance = dist[minRow][minCol] + weight;

				if (distance < dist[r][c]) {
					dist[r][c] = distance;
					prev[r][c] = [minRow, minCol];
				}
			}
		}

		const path = [];
		let currentRow = endRow;
		let currentCol = endCol;
		while (
			prev[currentRow][currentCol] !== null
			// &&!currentCell.className.includes('_wall')
		) {
			path.push(`${currentRow}-${currentCol}`);
			const [prevRow, prevCol] = prev[currentRow][currentCol];
			currentRow = prevRow;
			currentCol = prevCol;
		}

		path.push(`${startRow}-${startCol}`);
		path.reverse();

		return path;
	}
	const grid = new Array(35).fill().map(() => new Array(80).fill(1));
	const tds = document.querySelectorAll('td');
	for (let cell of tds) {
		if (cell.className.includes('wall')) {
			let cellId = cell.id.split('-');
			let row = cellId[0];
			let col = cellId[1];
			grid[row][col] = Infinity;
		}
	}
	const start = starting.split('-');
	const end = ending.split('-');
	let path = dijkstra(grid, start, end);
	return path;
};

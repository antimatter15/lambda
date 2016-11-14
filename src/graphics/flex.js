/**
 * Created by joel on 10/27/16.
 */

import * as d3 from 'd3';
import {send} from '../connect';
import {state} from '../utils';
import {editor} from '../editor';
const windows = {};

const default_scale = 0.1;
const tick_spacer = 50;

const fancy_f = '\u0192';

function flex([id, out, vals, args]) {
    if (windows.hasOwnProperty(id)) windows[id].update(out, vals);
    else windows[id] = new FlexWindow(id, out, vals, args);
}

class FlexWindow {
    constructor(id, out, vals, args) {
        this.id = id;
        this.out = out;
        this.vals = vals;
        this.args = args;

        this.open = true;
        this.points = [];

        this.container = document.createElement('div');
        this.container.className = 'flex';
        this.container.textContent = 'Hello world';

        const name = `#| flex ${id} |#`;
        editor.replaceRange(`\n${name}\n`, state.position, state.position);
        this.mark = editor.markText(
            {line: state.position.line},
            {line: state.position.line + 1, ch: name.length},
            {replacedWith: this.container}
        );

        // this.container.onclick = e => this.mark.clear();

        // this.width = default_width;
        // this.height = default_height;
        //
        // this.control = new Control(this);
        // this.content = new Content(this, this.width, this.height - this.control.table.offsetHeight);
    }
    get_value(i) {
        if (i >= 0) return this.vals[i];
        return this.out;
    }
    set_value(i, value, push) {
        if (this.open) {
            this.open = false;
            if (i >= 0) {
                const vals = this.vals.slice();
                vals[i] = value;
                const command = `(push-flex ${this.id} #(${vals.join(' ')}))\n`;
                send('eval', command);
            } else {
                const vals = this.args.map((arg, i) => this.control.fixed[arg].checked ? '#f' : '#t');
                const command = `(pull-flex ${this.id} ${value} #(${vals.join(' ')}))\n`;
                send('eval', command);
            }
        }
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.content.resize(this.width, this.height - this.control.table.offsetHeight);
    }
    update(out, vals) {
        this.open = true;
        this.out = out;
        this.vals = vals;
        this.control.update();
        this.content.update();
        // console.log(out, vals, args);
    }
}

class Control {
    constructor(parent) {
        this.parent = parent;
        this.width = parent.width;
        this.name = parent.name;
        this.args = parent.args;
        this.vals = parent.vals;
        this.out = parent.out;

        this.counter = 0;

        this.values = {};
        this.fixed = {};
        this.slider = {};
        this.mins = {};
        this.maxs = {};

        this.table = document.createElement('table');
        parent.dialog.appendChild(this.table);
        this.label_row = Control.addRow(this.table);
        Control.addCell(this.label_row, '');

        // make rows
        this.rows = this.args.map(arg => Control.addRow(this.table));
        this.output_row = Control.addRow(this.table);

        // add symbol column
        const make_div = content => {
            const div = document.createElement('div');
            div.textContent = content;
            return div;
        };
        Control.addCol(this.rows, (row, i) => this.values[this.args[i]] = make_div(this.args[i] + ': ' + this.vals[i]));
        Control.addCell(this.output_row, this.values[fancy_f] = make_div(fancy_f + ': ' + this.out));

        // add fixed column
        Control.addCell(this.label_row, 'Fix');
        Control.addCol(this.rows, (row, i) => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'fixed';
            input.name = this.name + '-fixed';
            this.fixed[this.args[i]] = input;
            return input;
        });
        Control.addCell(this.output_row);

        this.add = document.createElement('form');
        this.add_point = document.createElement('input');
        this.add_point.type = 'button';
        this.add_point.value = '+point';
        this.add_point.onclick = e => this.make_point(this.counter++);
        this.add.appendChild(this.add_point);
        this.add_path = document.createElement('input');
        this.add_path.type = 'button';
        this.add_path.value = '+path';
        this.add_path.onclick = e => this.make_path(this.counter++);
        this.add.appendChild(this.add_path);
        const make_slider = (i, value) => {
            const input = document.createElement('input');
            input.type = 'range';
            input.className = 'slider';
            input.name = this.name + '-slider';
            input.min = 0;
            input.max = 10;
            input.step = 0.1;
            input.value = value;
            input.oninput = e => this.parent.set_value(i, e.target.value);
            return input;
        };
        Control.addCell(this.label_row, this.add);
        Control.addCol(this.rows, (row, i) => this.slider[this.args[i]] = make_slider(i, this.vals[i]));
        Control.addCell(this.output_row, this.slider[fancy_f] = make_slider(-1, this.out));
    }

    static addCol(rows, content) {
        rows.forEach((row, i) => Control.addCell(row, content ? content(row, i) : false));
    }

    static addRow(table) {
        const row = document.createElement('tr');
        table.appendChild(row);
        return row;
    }

    static addCell(row, content) {
        const cell = document.createElement('td');
        if (typeof content == 'string') cell.textContent = content;
        else if (typeof content == 'object') cell.appendChild(content);
        row.appendChild(cell);
        return cell;
    }

    make_point(id) {
        const x_name = 'x-' + id, y_name = 'y-' + id;
        const make_pair = i => {
            const cell = document.createElement('td');
            const x = document.createElement('input');
            x.type = 'radio';
            x.name = x_name;
            x.onchange = e => this.update_mapping(e);
            x.value = i;
            if (i === 0) x.checked = true;
            const y = document.createElement('input');
            y.type = 'radio';
            y.name = y_name;
            y.onchange = e => this.update_mapping(e);
            y.value = i;
            if (i === -1) y.checked = true;
            cell.appendChild(x);
            cell.appendChild(y);
            return cell;
        };
        const label = document.createElement('td');
        label.textContent = 'x y';
        this.label_row.insertBefore(label, this.add.parentNode);
        this.rows.forEach((row, i) => row.insertBefore(make_pair(i), this.slider[this.args[i]].parentNode));
        this.output_row.insertBefore(make_pair(-1), this.slider[fancy_f].parentNode);
        this.parent.points.push({id, x: 0, y: -1});
        this.parent.content.update();
    }

    make_path(name) {
        const t_name = 't-' + name, x_name = 'x-' + name, y_name = 'y-' + name;
        const make_tuple = i => {
            const cell = document.createElement('td');
            const t = document.createElement('input');
            t.type = 'radio';
            t.name = t_name;
            t.onchange = e => this.update_mapping(e);
            t.value = i;
            if (i === 0) t.checked = true;
            const x = document.createElement('input');
            x.type = 'radio';
            x.name = x_name;
            x.onchange = e => this.update_mapping(e);
            x.value = i;
            if (i === 0) x.checked = true;
            const y = document.createElement('input');
            y.type = 'radio';
            y.name = y_name;
            y.onchange = e => this.update_mapping(e);
            y.value = i;
            if (i === -1) y.checked = true;
            cell.appendChild(t);
            cell.appendChild(x);
            cell.appendChild(y);
            this.parent.content.update();
            return cell;
        };
        const label = document.createElement('td');
        label.textContent = 't x y';
        this.label_row.insertBefore(label, this.add.parentNode);
        this.rows.forEach((row, i) => row.insertBefore(make_tuple(i), this.slider[this.args[i]].parentNode));
        this.output_row.insertBefore(make_tuple(-1), this.slider[fancy_f].parentNode);
    }
    update_mapping(e) {
        const {target} = e;
        const {name} = target;
        const [axis, index] = name.split('-');
        this.parent.points[index][axis] = target.value;
        this.parent.content.update();
    }
    update() {
        this.vals = this.parent.vals;
        this.out = this.parent.out;
        this.args.forEach((arg, i) => this.slider[arg].value = this.vals[i]);
        this.slider[fancy_f].value = this.out;
    }
    resize() {

    }
}

class Content {
    constructor(parent, width, height) {
        this.parent = parent;
        this.width = width;
        this.height = height;

        this.margin = {
            top: 8,
            left: 32,
            right: 8,
            bottom: 32
        };

        this.canvas_width = this.width - this.margin.left - this.margin.right;
        this.canvas_height = this.height - this.margin.top - this.margin.bottom;

        this.svg = d3.select(parent.dialog).append('svg')
            .attr('width', width)
            .attr('height', height);
        this.canvas = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const x_domain = (default_scale * this.canvas_width) / 2;
        const y_domain = (default_scale * this.canvas_height) / 2;
        this.x_scale = d3.scaleLinear().domain([- x_domain, x_domain]).range([0, this.canvas_width]);
        this.y_scale = d3.scaleLinear().domain([- y_domain, y_domain]).range([this.canvas_height, 0]);
        this.x_axis = d3.axisBottom(this.x_scale)
            .tickSizeOuter(0)
            .tickPadding(10)
            .ticks(Math.floor(this.canvas_width / tick_spacer))
            .tickSizeInner(-this.canvas_height);
        this.y_axis = d3.axisLeft(this.y_scale)
            .tickSizeOuter(0)
            .tickPadding(10)
            .ticks(Math.floor(this.canvas_height / tick_spacer))
            .tickSizeInner(-this.canvas_width);
        const e = e => e;
        this.transform = d3.zoomIdentity;
        this.x = this.canvas.append('g').attr('class', 'x axis x-axis');
        this.x.attr('transform', `translate(0,${this.canvas_height})`);
        this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
        this.y = this.canvas.append('g').attr('class', 'y axis y-axis');
        this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));
        this.svg.call(d3.zoom().on('zoom', e => {
            this.transform = d3.event.transform;
            this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
            this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));
            this.svg.selectAll('.point')
                .attr('cx', d => this.transform.applyX(this.x_scale(this.parent.get_value(d.x))))
                .attr('cy', d => this.transform.applyY(this.y_scale(this.parent.get_value(d.y))))
        }));
        this.resize(this.width, this.height);
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.svg.attr('width', width).attr('height', height);
        this.canvas_width = this.width - this.margin.left - this.margin.right;
        this.canvas_height = this.height - this.margin.top - this.margin.bottom;

        const [x0, x1] = this.x_scale.domain(), [y0, y1] = this.y_scale.domain();
        this.x_scale.domain([x0, this.x_scale.invert(this.canvas_width)]).range([0, this.canvas_width]);
        this.y_scale.domain([this.y_scale.invert(this.canvas_height), y1]).range([this.canvas_height, 0]);

        this.x_axis.ticks(Math.floor(this.canvas_width / tick_spacer)).tickSizeInner(-this.canvas_height);
        this.y_axis.ticks(Math.floor(this.canvas_height / tick_spacer)).tickSizeInner(-this.canvas_width);

        this.x.attr('transform', `translate(0,${this.canvas_height})`);
        this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
        this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));
    }
    update() {
        const points = this.canvas.selectAll('.point');
        const update = (d, i, a) => {
            const {offsetX, offsetY} = d3.event.sourceEvent;
            const X = offsetX - this.margin.left, Y = offsetY - this.margin.top;
            const sx = this.x_scale.invert(this.transform.invertX(X)), sy = this.y_scale.invert(this.transform.invertY(Y));
            let px = sx, py = sy;
            const {x, y} = this.parent.points[i];
            if (x === y) px = py = (px + py) / 2;
            if (x < 0) this.parent.out = px;
            else this.parent.vals[x] = px;
            if (y < 0) this.parent.out = py;
            else this.parent.vals[y] = py;
            const vals = this.parent.args.map((arg, i) => {
                if (i === x) return px;
                if (i === y) return py;
                if (i >= 0 && this.parent.control.fixed[arg].checked) return '#f';
                return '#t';
            });
            const command = (x < 0 || y < 0) ?
                `(pull-flex ${this.parent.id} ${this.parent.out} #(${vals.join(' ')}))\n` :
                `(push-flex ${this.id} #(${vals.join(' ')}))\n`;
            if (this.parent.open) {
                this.parent.open = false;
                send('eval', command);
            }
        };
        points.data(this.parent.points).enter().append('circle')
            .attr('class', 'point')
            .attr('r', 8)
            .call(d3.drag().on('start', update).on('drag', update).on('end', update))
            .merge(points)
            .attr('cx', d => this.transform.applyX(this.x_scale(this.parent.get_value(d.x))))
            .attr('cy', d => this.transform.applyY(this.y_scale(this.parent.get_value(d.y))))
    }
}

export {flex};

/**
 * Created by joel on 10/27/16.
 */

import * as d3 from 'd3';
import {Window} from './graphics';
import {state, default_width, default_height} from '../utils';
import {push_repl} from '../repl';
const {windows} = state;

const default_scale = 0.1;
const tick_spacer = 50;
const default_domain = [0, 10];

const slider_height = 36;
const label_gutter = 36;
const label_margin = 24;
const check_width = 36;

const fancy_f = '\u0192';

function flex({id, out, vals, args}) {
    const name = `flex-${id}`;
    // console.log(name, out, vals, args);
    if (windows.hasOwnProperty(name)) windows[name].update(out, vals, args);
    else {
        console.log('creating new flex window', name, id, out, vals, args);
        new FlexWindow(name, id, out, vals, args);
    }
}

class FlexWindow extends Window {
    constructor(name, id, out, vals, args) {
        super(name);
        this.width = default_width;
        this.height = default_height;
        this.svg = d3.select(this.dialog).append('svg');
        this.content_container = this.svg.append('g');
        this.control_container = this.svg.append('g');
        this.control = new Control(this, width, id, out, vals, args);
        this.control_height = this.control.height;
        this.content_height = this.height - this.control_height;
        this.content = new Content(this, width, this.content_height);
        this.control_container.attr('transform', `translate(0,${this.content_height})`);
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.svg.attr('width', this.width).attr('height', this.height);
        this.control_height = this.control.resize(width);
        this.content_height = this.height - this.control_height;
        this.content.resize(width, this.content_height);
        this.control_container.attr('transform', `translate(0,${this.content_height})`);
    }
    update(out, vals, args) {
        console.log(out, vals, args);
    }
}

class Content {
    constructor(parent, width, height) {
        this.width = width;
        this.height = height;

        this.margin = {
            top: 8,
            left: 32,
            right: 8,
            bottom: 64
        };

        this.canvas_width = this.width - this.margin.left - this.margin.right;
        this.canvas_height = this.height - this.margin.top - this.margin.bottom;

        this.background = parent.content_container.append('rect')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', 'white');

        this.canvas = parent.svg.append('g')
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
        this.y_axis = d3.axisBottom(this.y_scale)
            .tickSizeOuter(0)
            .tickPadding(10)
            .ticks(Math.floor(this.canvas_height / tick_spacer))
            .tickSizeInner(-this.canvas_width);
        this.x = this.canvas.append('g').attr('class', 'x axis x-axis');
        this.x.attr('transform', `translate(0,${this.canvas_height})`);
        this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
        this.y = this.canvas.append('g').attr('class', 'y axis y-axis');
        this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));
        this.background.call(d3.zoom().on('zoom', e => {
            this.transform = d3.event.transform;
            this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
            this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));
        }));
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas_width = this.width - this.margin.left - this.margin.right;
        this.canvas_height = this.height - this.margin.top - this.margin.bottom;

        const [x0, x1] = this.x_scale.domain(), [y0, y1] = this.y_scale.domain();
        this.x_scale.domain([x0, this.x_scale.invert(this.canvas_width)]).range([0, this.canvas_width]);
        this.y_scale.domain([this.y_scale.invert(this.canvas_height), y1]).range([this.canvas_height, 0]);

        this.background.attr('width', this.width).attr('height', this.height);
        this.x_axis.ticks(Math.floor(this.canvas_width / tick_spacer)).tickSizeInner(-this.canvas_height);
        this.y_axis.ticks(Math.floor(this.canvas_height / tick_spacer)).tickSizeInner(-this.canvas_width);

        this.x.attr('transform', `translate(0,${this.canvas_height})`);
        this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
        this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));

        // TODO: Update point and path locations
    }
}

class Control {
    constructor(parent, width, id, out, vals, args) {
        this.id = id;
        this.out = out;
        this.vals = vals;
        this.args = args;
        this.width = width;
        this.height = label_gutter;
        this.env = {};

        this.label_container = parent.control_container.append('g');
        this.slider_container = parent.control_container.append('g');
        this.slider_container.attr('transform', `translate(0,${label_gutter})`);

        this.args.forEach((arg, i) => this.add_row(this, arg, vals[i], true));
        this.add_row(this, fancy_f, out, false);
    }
    add_row(symbol, value) {
        this.height += slider_height;
        this.env[symbol] = new Row(this, symbol, value);
    }
    add_point(name) {
        // this.rows.forEach(row => row.add_point(name));
        const point = new Point(name);
        Object.keys(this.env).map(key => this.env[key]).forEach(point.append);
    }
    add_path(name) {
        this.rows.forEach(row => row.add_path(name));
    }
    resize(width) {
        this.rows.forEach(row => row.resize(width));
        return this.height;
    }
    update(out, vals) {

    }
}

class Row {
    constructor(parent, symbol, value, input) {
        this.width = parent.width;
        this.height = slider_height;
        this.symbol = symbol;
        this.value = value;
        this.input = input;

        this.thing_margin = 8;
        this.thing_width = check_width;
        this.things = [];

        this.slider_width = this.width - label_margin - this.thing_width;

        this.row_container = parent.slider_container.append('g');
        this.label = this.row_container.append('text').text(this.symbol);
        this.slider = this.row_container.append('line').attr('class', 'slider')
            .attr('x1', label_margin).attr('y1', 0)
            .attr('x2', this.slider_width).attr('y2', 0)
            .attr('stroke-width', 1)
            .attr('stroke', 'black');

        this.track = this.row_container.append('g').attr('class', 'axis slider-axis');
        this.scale = d3.scaleLinear().domain(default_domain).range([0, this.slider_width]).clamp(true);
        this.axis = d3.axisBottom(this.scale).ticks(Math.floor(this.slider_width / tick_spacer));
        this.track.call(this.axis);

        this.handle = this.slider.append('circle')
            .attr('r', 6)
            .attr('cx', this.scale(value))
            .attr('cy', 0);

        if (input) {
            this.checkbox = this.row_container.append('foreignObject')
                .attr('width', check_width).attr('height', this.height)
                .attr('transform', `translate(${this.slider_width - check_width},0)`);
            const html = `<form><input type="checkbox" id="fixed-${symbol}"/></form>`;
            this.checkbox.append('xhtml:body').html(html);
            this.fixed = d3.select(`#fixed-${symbol}`).node();
        }
    }
    is_fixed() {
        return this.checkbox && this.fixed.checked;
    }
    add_thing(width, height, html) {
        const element = this.row_container.append('foreignObject')
            .attr('width', width).attr('height', height)
            .attr('transform', `translate(${this.thing_width},0)`);
        element.append('xhtml:body').html(html);
        this.things.push({width, height, element, offset: this.thing_width});
        this.thing_width += this.thing_margin + width;
    }
    resize(width) {
        this.slider_width = this.width - label_margin - this.thing_width;
    }
}

class Thing {
    constructor(name) {
        this.name = name;
        this.height = slider_height;
    }
}

class Point extends Thing {
    constructor(name) {
        super(name);
        this.width = 48;
        this.x = [];
        this.y = [];
    }
    append(row, index, array) {
        const x_name = this.name + '-x', y_name = this.name + '-y';
        const x_id = `${row.symbol}-${x_name}`, y_id = `${row.symbol}-${y_name}`;
        const x_checked = index == 0 ? 'checked' : '';
        const y_checked = index == array.length - 1 ? 'checked' : '';
        const x = `<input type="radio" class="control control-point" id="${x_id}" name="${x_name}" ${x_checked}/>`;
        const y = `<input type="radio" class="control control-point" id="${y_id}" name="${y_name}" ${y_checked}/>`;
        const html = x + y;
        row.add_thing(this.width, this.height, html);
        this.x.push(document.getElementById(x_id));
        this.y.push(document.getElementById(y_id));
    }
}

class Path extends Thing {
    constructor(name) {
        super(name);
        this.width = 64;
        this.t = [];
        this.x = [];
        this.y = [];
    }
    append(row, index, array) {
        const s = row.symbol;
        const t_name = this.name + '-t', x_name = this.name + '-x', y_name = this.name + '-y';
        const t_id = `${s}-${t_name}`, x_id = `${s}-${x_name}`, y_id = `${s}-${y_name}`;
        const t_checked = index == 0 ? 'checked' : '';
        const x_checked = index == 0 ? 'checked' : '';
        const y_checked = index == array.length - 1 ? 'checked' : '';
        const t = `<input type="radio" class="control control-point" id="${t_id}" name="${t_name}" ${t_checked}/>`;
        const x = `<input type="radio" class="control control-point" id="${x_id}" name="${x_name}" ${x_checked}/>`;
        const y = `<input type="radio" class="control control-point" id="${y_id}" name="${y_name}" ${y_checked}/>`;
        const html = t + x + y;
        row.add_thing(this.width, this.height, html);
        this.t.push(document.getElementById(t_id));
        this.x.push(document.getElementById(x_id));
        this.y.push(document.getElementById(y_id));
    }
}
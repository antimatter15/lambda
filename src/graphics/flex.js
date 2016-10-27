/**
 * Created by joel on 18/8/16.
 */

import * as d3 from 'd3';
import {Window} from './graphics';
import {state} from '../utils';
import {push_repl} from '../repl';
const {windows} = state;

const default_scale = 0.1;
const tick_spacer = 50;
const default_domain = [0, 10];

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
        super(name, true);
        this.open = true;
        this.vals = vals || [];
        this.args = args || [];
        this.id = id;
        this.offset_width = 32;
        this.margin = {top: 8, left: 32, right: 8, bottom: 64};
        this.slider_height = (this.vals.length + 1) * Slider.size();
        this.canvas_width = this.width - this.margin.right - this.margin.left;
        this.canvas_height = this.height - this.margin.top - this.margin.bottom - this.slider_height;
        this.svg = d3.select(this.dialog).append('svg');
        this.canvas_background = this.svg.append('rect')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`)
            .attr('width', this.canvas_width)
            .attr('height', this.canvas_height)
            .attr('fill', 'white');
        this.canvas = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        const xDomain = (default_scale * this.canvas_width) / 2;
        const yDomain = (default_scale * this.canvas_height) / 2;
        this.x_scale = d3.scaleLinear().domain([- xDomain, xDomain]).range([0, this.canvas_width]);
        this.y_scale = d3.scaleLinear().domain([- yDomain, yDomain]).range([this.canvas_height, 0]);
        this.transform = {rescaleX: e => e, rescaleY: e => e};
        this.x_axis = d3.axisBottom(this.x_scale).tickSizeOuter(0).tickPadding(10);
        this.y_axis = d3.axisLeft(this.y_scale).tickSizeOuter(0).tickPadding(10);
        this.x = this.canvas.append('g').attr('class', 'x axis x-axis');
        this.y = this.canvas.append('g').attr('class', 'y axis y-axis');
        this.canvas_background.call(d3.zoom().on("zoom", e => {
            this.transform = d3.event.transform;
            this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
            this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));
        }));
        this.controls = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.height - this.slider_height})`);
        this.label_container = this.controls.append('g');
        this.label_container.append('text').text('Symbols').attr('transform', `translate(${-Slider.margin()},-16)`);
        this.labels = [{element: this.label_container.append('text').text('Fixed'), offset: -12}];
        this.sliders = this.vals.map((val, i) => new Slider(this, this.args[i], i, val));
        this.output = new Slider(this, fancy_f, this.args.length, out, true);
        this.points = [];
        this.buttons = {};
        this.point('point');
        this.resize(this.width, this.height);
    }
    update(out, vals) {
        this.open = true;
        this.vals = vals;
        console.log(vals);
        this.output.handle.attr('cx', this.output.scale(this.output.value = out));
        this.sliders.forEach((slider, i) => slider.handle.attr('cx', slider.scale(slider.value = vals[i])));
        this.points.forEach(({name, element}, i) => {
            const location = this.get_axis(name);
            if (location) {
                const x = this.transform.rescaleX(this.x_scale).invert(location.x.value);
                const y = this.transform.rescaleY(this.y_scale).invert(location.y.value);
                console.log(x, y);
                element.attr('cx', x).attr('cy', y);
            }
        });
    }
    resize(width, height) {
        this.width = width > this.margin.right + this.margin.left ? width : this.width;
        this.height = height > this.margin.top + this.margin.bottom + this.slider_height ? height : this.height;
        this.canvas_width = this.width - this.margin.right - this.margin.left;
        this.canvas_height = this.height - this.margin.top - this.margin.bottom - this.slider_height;
        const [x0, x1] = this.x_scale.domain(), [y0, y1] = this.y_scale.domain();
        this.x_scale.domain([x0, this.x_scale.invert(this.canvas_width)]).range([0, this.canvas_width]);
        this.y_scale.domain([this.y_scale.invert(this.canvas_height), y1]).range([this.canvas_height, 0]);

        this.svg.attr('width', this.width).attr('height', this.height);
        this.canvas_background.attr('width', this.canvas_width).attr('height', this.canvas_height);

        this.x_axis.ticks(Math.floor(this.canvas_width / tick_spacer)).tickSizeInner(-this.canvas_height);
        this.y_axis.ticks(Math.floor(this.canvas_height / tick_spacer)).tickSizeInner(-this.canvas_width);

        this.x.attr('transform', `translate(0,${this.canvas_height})`);
        this.x.call(this.x_axis.scale(this.transform.rescaleX(this.x_scale)));
        this.y.call(this.y_axis.scale(this.transform.rescaleY(this.y_scale)));

        this.controls.attr('transform', `translate(${this.margin.left},${this.margin.top + this.canvas_height + this.margin.bottom})`);
        this.sliders.forEach(slider => slider.resize(this.canvas_width, this.offset_width));
        this.output.resize(this.canvas_width, this.offset_width);

        this.labels.forEach(label => label.element.attr('transform', `translate(${this.canvas_width - this.offset_width + label.offset},-16)`))
        this.points.forEach(({name, element}, i) => {
            const location = this.get_axis(name);
            if (location) {
                const x = this.transform.rescaleX(this.x_scale)(location.x.value);
                const y = this.transform.rescaleY(this.y_scale)(location.y.value);
                console.log(x, y);
                element.attr('cx', x).attr('cy', y);
            }
        });
    }
    get_axis(name) {
      const x = this.buttons[name].x.find(b => b.node.checked);
      const y = this.buttons[name].y.find(b => b.node.checked);
      if (x && y) return {x, y};
      else return false;
    }
    point(name) {
        this.buttons[name] = {x: [], y: []};
        const x = this.label_container.append('text').text('x');
        this.labels.push({element: x, offset: this.offset_width + 12});
        const y = this.label_container.append('text').text('y');
        this.labels.push({element: y, offset: this.offset_width + 28});
        this.sliders.forEach((slider, index) => slider.point(name, this.offset_width, index === 0, false));
        this.offset_width = this.output.point(name, this.offset_width, false, true);
        const element = this.canvas.append('circle').attr('r', 8).attr('fill', 'black');
        let transform = (arg, X, Y) => '#t';
        const find = () => {
            const location = this.get_axis(name);
            if (location) {
                transform = (arg, X, Y) => {
                  if (arg === location.x.label) return X;
                  if (arg === location.y.label) return Y;
                  return '#t';
                }
            }
        };
        const move = () => {
            if (this.open) {
                const X = this.x_scale.invert(d3.event.x), Y = this.y_scale.invert(d3.event.y);
                const goal = this.args.map(arg => transform(arg, X, Y));
                const out = transform(fancy_f, X, Y);
                const command = `(pull-flex ${this.id} ${out} #(${goal.join(' ')}))`;
                this.open = false;
                push_repl(command + '\n', true);
            }
        };
        element.call(d3.drag().on('start', () => find() && move()).on('drag', move).on('end', move));
        this.points.push({name, element});
    }
    path(name) {
        const x_name = name + '-x', y_name = name + '-y', t_name = name + '-t';
        const x = this.label_container.append('text').text('x');
        this.labels.push({element: x, offset: this.offset_width + 12});
        const y = this.label_container.append('text').text('y');
        this.labels.push({element: y, offset: this.offset_width + 28});
        const t = this.label_container.append('text').text('t');
        this.labels.push({element: t, offset: this.offset_width + 44});
        this.sliders.forEach((slider, index) => slider.path(x_name, y_name, t_name, this.offset_width, index === 0, index === 0, false));
        this.offset_width = this.output.path(x_name, y_name, t_name, this.offset_width, false, false, true);
    }
}

class Point {
    constructor(parent) {

    }
}

class Slider {
    constructor(parent, label, index, value, output) {
        this.parent = parent;
        this.label = label;
        this.index = index;
        this.width = parent.canvas_width;
        this.value = value || 1;
        this.offset_height = index * Slider.size();
        this.offset_width = parent.offset_width;
        this.slider_width = this.width - this.offset_width;
        this.slider = parent.controls.append('g')
            .attr('class', 'slider')
            .attr('transform', `translate(0,${this.offset_height})`);
        this.slider.append('text')
            .text(this.label)
            .attr('transform', `translate(${-Slider.margin()},4)`);
        this.line = this.slider.append('line')
            .attr('class', 'line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', this.width)
            .attr('y2', 0)
            .attr('stroke-width', 1)
            .attr('stroke', 'black');
        this.track = this.slider.append('g').attr('class', 'axis slider-axis');
        this.scale = d3.scaleLinear().domain(default_domain).range([0, this.slider_width]).clamp(true);
        this.axis = d3.axisBottom(this.scale).ticks(Math.floor(this.slider_width / tick_spacer));
        this.track.call(this.axis);
        this.handle = this.slider.append('circle')
            .attr('r', 6)
            .attr('cx', this.scale(value))
            .attr('cy', 0);

        this.objects = [];
        if (output) {

          const update = () => {
            if (this.parent.open) {
              const value = this.scale.invert(d3.event.x);
              const vals = this.parent.sliders.map((slider, index) => slider.check.checked ? '#f' : '#t');
              const command = `(pull-flex ${this.parent.id} ${value} #(${vals.join(' ')}))`;
              this.parent.open = false;
              push_repl(command + '\n', true);
            }
          };

          const drag = d3.drag().on('start', update).on('drag', update).on('end', update);
          this.line.call(drag);
          this.handle.call(drag);

        } else {

          const update = () => {
              if (this.parent.open) {
                const value = this.scale.invert(d3.event.x);
                const vals = this.parent.vals.map((val, i) => i === this.index ? value : vals);
                const command = `(push-flex ${this.parent.id} #(${vals.join(' ')}))`;
                this.parent.open = false;
                push_repl(command + '\n', true);
              }
          };

          const drag = d3.drag().on('start', update).on('drag', update).on('end', update);
          this.line.call(drag);
          this.handle.call(drag);

          this.fixed = this.slider.append("foreignObject").attr("width", 32).attr("height", 32);
          this.fixed.append("xhtml:body").html(`<form><input type="checkbox" id="fixed-${label}"/></form>`);
          this.check = d3.select(`#fixed-${label}`).node();
        }
    }
    resize(width) {
        this.width = width;
        this.slider_width = width - this.offset_width;
        this.slider.attr('transform', `translate(0,${this.offset_height})`);
        this.line.attr('x2', this.slider_width);
        this.scale.range([0, this.slider_width]);
        this.axis.ticks(Math.floor(this.slider_width / tick_spacer)).scale(this.scale);
        this.track.call(this.axis);
        this.handle.attr('cx', this.scale(this.value));
        if (this.fixed) this.fixed.attr('transform', `translate(${this.slider_width + 8},-8)`);
        this.objects.forEach(({point, offset}) => point.attr('transform', `translate(${this.slider_width + offset},-8)`))
    }
    static size() {
        return 36;
    }
    static margin() {
        return 24;
    }
    point(name, offset, x_checked, y_checked) {
        const x_name = name + '-x', y_name = name + '-y';
        const x = `<input type="radio" class="control" id="${this.label}-${x_name}" name="${x_name}" ${x_checked ? 'checked' : ''}/>`;
        const y = `<input type="radio" class="control" id="${this.label}-${y_name}" name="${y_name}" ${y_checked ? 'checked' : ''}/>`;
        const html = x + y;
        const point = this.slider.append("foreignObject").attr("width", 64).attr("height", 32);
        point.append("xhtml:body").html(html);
        const x_node = d3.select(`#${this.label}-${x_name}`).node();
        const y_node = d3.select(`#${this.label}-${y_name}`).node();
        this.parent.buttons[name].x.push({node: x_node, label: this.label, value: this.value});
        this.parent.buttons[name].y.push({node: y_node, label: this.label, value: this.value});
        this.objects.push({point, offset});
        return this.offset_width += 48;
    }
    path(x_name, y_name, t_name, offset, x_checked, y_checked, t_checked) {
        const x = `<input type="radio" class="control" name="${x_name}" ${x_checked ? 'checked' : ''}/>`;
        const y = `<input type="radio" class="control" name="${y_name}" ${y_checked ? 'checked' : ''}/>`;
        const t = `<input type="radio" class="control" name="${t_name}" ${t_checked ? 'checked' : ''}/>`;
        const html = x + y + t;
        const point = this.slider.append("foreignObject").attr("width", 96).attr("height", 32);
        point.append("xhtml:body").html(html);
        this.objects.push({point, offset});
        return this.offset_width += 64;
    }
}

export {flex};

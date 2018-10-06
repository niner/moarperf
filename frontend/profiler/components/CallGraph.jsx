import React, {Component} from 'react';
import {Breadcrumb, BreadcrumbItem, Button, Col, Container, Row, Table} from 'reactstrap';
import {Link, Redirect} from 'react-router-dom';
import $ from 'jquery';
import ErrorBoundary from 'react-error-boundary'

import {
    EntriesInfo,
    ExclusiveInclusiveTime,
    InlineInfo,
    LinkButton,
    numberFormatter,
    RoutineFileInfo,
    RoutineNameInfo
} from "./RoutinePieces";
import {AllocTableContent} from "./AllocationParts";


export default class CallGraph extends Component<{ routines: *, callId: * }> {
    constructor (props) {
        super(props);
        this.state = {
            isLoading: {
                path: false,
                children: false,
                allocs: false,
                incAllocs: false,
                childIncAllocs: false,
            },
            error: null,
            allocsError: null,
            path: [],
            children: [],
            call: {},
            allocations: [],
            inclusiveAllocations: [],
            childInclusiveAllocations: {},
        }
    }

    requestPathAndChildren() {
        if (typeof this.props.callId === "undefined")
            return;
        this.setState((state) => ({
            isLoading: {
                ...state.isLoading,
                path: true,
                children: true,
                allocs: true
            }
        }));

        const stateChangeForPath = (self, path, currentCallId) => {
            if (currentCallId !== self.props.callId)
                return;
            this.setState(state => ({isLoading: { path: false }, path: path.slice(0, -1) }))
        }

        $.ajax({
            url: '/call-path/' + this.props.callId,
            type: 'GET',
            contentType: 'application/json',
            success: (path) => stateChangeForPath(this, path, this.props.callId),
            error: (xhr, errorStatus, errorText) => {this.setState(state => ({isLoading: { path: false }, error: errorStatus + errorText}))}
        });

        const stateChangeForChildren = (self, children, currentCallId) => {
            if (currentCallId !== self.props.callId)
                return;
            const childs = Array.from(children);
            const thisCall = childs.shift();
            self.setState((state) => ({
                isLoading: { children: false },
                children: childs.sort((a, b) => (b.inclusive - a.inclusive)),
                call: thisCall
            }));
        }

        $.ajax({
            url: '/call-children/' + this.props.callId,
            type: 'GET',
            contentType: 'application/json',
            success: (children) => stateChangeForChildren(this, children, this.props.callId),
            error: (xhr, errorStatus, errorText) => {this.setState(state => ({isLoading: { children: false }, error: errorStatus + errorText}))}
        });

        const stateChangeForAlloc = (self, allocs, currentCallId) => {
            if (currentCallId !== self.props.callId)
                return;
            self.setState((state) => ({
                allocations: allocs,
                isLoading: { allocs: false }
            }));
        }

        $.ajax({
            url: '/call-allocations/' + this.props.callId,
            type: 'GET',
            contentType: 'application/json',
            success: (allocs) => stateChangeForAlloc(this, allocs, this.props.callId),
            error: (xhr, errorStatus, errorText) => {this.setState(state => ({isLoading: { allocs: false }, allocsError: errorStatus + errorText}))}
        });
    }

    requestInclusiveAllocations() {
        this.setState((state) => ({
            isLoading: {
                incAllocs: true
            }
        }));

        const stateChangeForIncAllocs = (self, allocs) => {
            self.setState((state) => ({
                inclusiveAllocations: allocs,
                isLoading: { incAllocs: false }
            }))
        }

        $.ajax({
            url: '/inclusive-call-allocations/' + this.props.callId,
            type: 'GET',
            contentType: 'application/json',
            success: (allocs) => stateChangeForIncAllocs(this, allocs),
            error: (xhr, errorStatus, errorText) => {this.setState(state => ({isLoading: { incAllocs: false }, allocsError: errorStatus + errorText}))}
        })
    }

    requestChildInclusiveAllocations() {
        this.setState((state) => ({
            isLoading: {
                childIncAllocs: this.state.children.length
            }
        }));

        const stateChangeForIncAllocs = (self, allocs, child_id) => {
            self.setState((state) => ({
                isLoading: {
                    childIncAllocs: state.isLoading.childIncAllocs - 1
                },
                childInclusiveAllocations: {
                    ...state.childInclusiveAllocations,
                    [child_id]: allocs
                }
            }))
        };

        this.state.children.forEach((child, idx) => {
            $.ajax({
                url: '/inclusive-call-allocations/' + child.id,
                type: 'GET',
                contentType: 'application/json',
                success: (allocs) => stateChangeForIncAllocs(this, allocs, child.id),
                error: (xhr, errorStatus, errorText) => {this.setState(state => ({isLoading: { childIncAllocs: state.isLoading.childIncAllocs - 1 }, allocsError: errorStatus + errorText}))}
            })
        })
    }

    componentDidMount() {
        this.requestPathAndChildren()
    }

    componentDidUpdate(prevProps) {
        if (prevProps.callId !== this.props.callId) {
            this.setState((state) => ({
                isLoading: {
                    ...state.isLoading,
                    incAllocs: false,
                    childIncAllocs: false,
                },
                call: {},
                path: [],
                error: null,
                allocsError: null,
                allocations: [],
                inclusiveAllocations: [],
                childInclusiveAllocations: [],
            }));
            this.requestPathAndChildren();
        }
    }

    render() {
        let {
            routines,
            callId,
        } = this.props;

        let {
            call,
            isLoading: {
                path: loadingPath,
                children: loadingChildren,
                allocs: loadingAllocations,
                incAllocs: loadingInclusiveAllocations,
                childIncAllocs: loadingChildIncAllocations,
            },
            error,
            path,
            children,
            allocations,
            inclusiveAllocations,
            childInclusiveAllocations,
        } = this.state;

        if (typeof callId === "undefined") {
            return (
                <Redirect to={"/prof/callgraph/" + (call.id || "0")} />
            )
        }

        if (loadingPath || loadingChildren || typeof call === "undefined") {
            return (<Container><div>Hold on...</div></Container>)
        }

        if (error) {
            return (<Container>
                <div>
                    Error: { error }
                </div>
            </Container>)
        }

        if (typeof routines[call.routine_id] === "undefined") {
            return (
                <Container>
                    <div>
                        Error: maybe routine { call.routine_id } doesn't exist, or this page hasn't finished loading yet ...<br/>
                        Give it a second, or maybe you have to switch to the routine tab and click "get routine overview".
                    </div>
                </Container>
            )
        }

        console.log("children:", children);
        console.log("path:", path);

        const routine = routines[call.routine_id];
        return (
            <Container>
                <Row>
                    <Col>
                        <Breadcrumb>
                            {
                                path.map((node, idx) => (
                                    <BreadcrumbItem key={"breadcrumb_" + idx}>
                                        <Link to={node.call_id.toString()}>
                                            { routines[node.routine_id].name }
                                        </Link>
                                    </BreadcrumbItem>
                                ))
                            }
                            <BreadcrumbItem active>{ routine.name }</BreadcrumbItem>
                        </Breadcrumb>
                    </Col>
                </Row>
                <Row><Col>
                    <h2>{routine.name}</h2>
                    <div><RoutineFileInfo routine={routine} /></div>
                    <Table striped>
                        <tbody>
                        <tr>
                            <td width="50%">Entries</td>
                            <td width="50%">{numberFormatter(call.entries)}</td>
                        </tr>
                        <tr>
                            <td>Fully Jitted / Only Specialized</td>
                            <td>{numberFormatter(call.jit_entries)} / {numberFormatter(call.spesh_entries)}</td>
                        </tr>
                        <tr>
                            <td>Exclusive / Inclusive time</td>
                            <ExclusiveInclusiveTime routine={call}/>
                        </tr>
                        <tr>
                            <td>Inlined</td>
                            <InlineInfo routine={call}/>
                        </tr>
                        <tr>
                            <td>Specializer Info</td>
                            <td>
                                { call.osr && <span>OSR'd {call.osr} times</span> }
                                { call.deopt_one && <span>Partially Deopted {call.deopt_one} times</span> }
                                { call.deopt_all && <span>Fully Deopted {call.deopt_all} times</span> }
                            </td>
                        </tr>
                        </tbody>
                    </Table>
                </Col></Row>
                <Row><Col>
                    <Button onClick={() => this.requestChildInclusiveAllocations() }>Show allocations for all children</Button>
                <Table striped><tbody>
                    {
                        children.map((child, idx) => (<React.Fragment>
                            <tr key={"child_" + idx}>
                                <LinkButton target={child.id.toString()} icon={"arrow-right"}/>
                                <RoutineNameInfo routine={routines[child.routine_id]}/>
                                <EntriesInfo routine={child} parentEntries={call.entries}/>
                                <InlineInfo routine={child}/>
                                <ExclusiveInclusiveTime routine={child} maxTime={call.inclusive}/>
                            </tr>
                            {
                                childInclusiveAllocations.hasOwnProperty(child.id.toString()) && childInclusiveAllocations[child.id.toString()].length > 0 &&
                                <tr><td style={{paddingTop: "0px", paddingLeft: "10%", paddingRight: "10%"}} colSpan={5}>
                                    <Table striped style={{border: "1px solid black"}}><tbody>
                                    <ErrorBoundary><AllocTableContent
                                        allocations={childInclusiveAllocations[child.id.toString()]}
                                        parentBareEntries={child.entries}
                                        parentSpeshJitEntries={child.jit_entries + child.spesh_entries} />
                                    </ErrorBoundary>
                                    </tbody></Table>
                                </td></tr>
                            }
                            </React.Fragment>
                        ))
                    }
                </tbody></Table></Col></Row>
                <Row><Col>
                        <h2>Allocations</h2>
                        <Table striped><tbody>
                        <ErrorBoundary>
                        <AllocTableContent allocations={allocations} parentBareEntries={call.entries} parentSpeshJitEntries={call.spesh_entries + call.jit_entries} />
                        </ErrorBoundary>
                        { loadingAllocations && <th><td colSpan={3}><span>Loading allocations...</span></td></th> }
                        { inclusiveAllocations.length === 0 && <Button onClick={() => this.requestInclusiveAllocations()}>Load inclusive allocations</Button> }
                        { loadingInclusiveAllocations && <th><td colSpan={3}><span>Loading inclusive allocations...</span></td></th> }
                        { inclusiveAllocations.length !== 0 && <th><td colSpan={3}>Inclusive Allocations</td></th>}
                        <ErrorBoundary>
                        <AllocTableContent allocations={inclusiveAllocations} parentBareEntries={call.entries} parentSpeshJitEntries={call.spesh_entries + call.jit_entries} />
                        </ErrorBoundary>
                        </tbody></Table>
                </Col></Row>
            </Container>
        )
    }
}
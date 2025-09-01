import os
from flask import Flask, render_template, request, jsonify
import numpy as np
import json
import logging
import copy
import re


# 尝试导入pypower，如果不存在则提供说明
try:
    import pypower.api as pp
    from pypower import case9, case14, case30, case39, case57, case118
    
    PYPOWER_AVAILABLE = True
except ImportError:
    PYPOWER_AVAILABLE = False
    print("警告: pypower库未安装，请使用 pip install pypower 安装")

app = Flask(__name__)

# 创建数据目录（如果不存在）
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# 配置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# 解析MATPOWER格式文件
def parse_matpower_file(file_path):
    """解析MATPOWER格式的.m文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 如果是函数格式，提取函数体内容
    if 'function mpc =' in content:
        # 移除函数定义行，只处理函数体
        lines = content.split('\n')
        function_body = []
        in_function = False
        for line in lines:
            if 'function mpc =' in line:
                in_function = True
                continue
            elif in_function and line.strip().startswith('end'):
                break
            elif in_function:
                function_body.append(line)
        content = '\n'.join(function_body)
    
    # 提取baseMVA
    baseMVA_match = re.search(r'mpc\.baseMVA\s*=\s*(\d+(?:\.\d+)?)', content)
    baseMVA = float(baseMVA_match.group(1)) if baseMVA_match else 100.0
    
    # 提取bus数据
    bus_match = re.search(r'mpc\.bus\s*=\s*\[(.*?)\];', content, re.DOTALL)
    bus_data = []
    if bus_match:
        for line in bus_match.group(1).strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('%'):
                values = [float(x) for x in line.split()]
                bus_data.append(values)
    
    # 提取gen数据
    gen_match = re.search(r'mpc\.gen\s*=\s*\[(.*?)\];', content, re.DOTALL)
    gen_data = []
    if gen_match:
        for line in gen_match.group(1).strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('%'):
                values = [float(x) for x in line.split()]
                gen_data.append(values)
    
    # 提取branch数据
    branch_match = re.search(r'mpc\.branch\s*=\s*\[(.*?)\];', content, re.DOTALL)
    branch_data = []
    if branch_match:
        for line in branch_match.group(1).strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('%'):
                values = [float(x) for x in line.split()]
                branch_data.append(values)
    
    # 提取bus坐标（自定义扩展）
    coords_match = re.search(r'mpc\.bus_coords\s*=\s*\[(.*?)\];', content, re.DOTALL)
    bus_coords = {}
    if coords_match:
        for line in coords_match.group(1).strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('%'):
                values = [float(x) for x in line.split()]
                bus_coords[int(values[0])] = {'x': values[1], 'y': values[2]}
    
    return {
        'baseMVA': baseMVA,
        'bus': np.array(bus_data),
        'gen': np.array(gen_data),
        'branch': np.array(branch_data),
        'bus_coords': bus_coords
    }

# 将MATPOWER格式转换为JSON格式
def matpower_to_json(matpower_data):
    """将MATPOWER格式数据转换为可视化所需的JSON格式"""
    nodes = []
    links = []
    
    # 处理节点数据
    for i, bus in enumerate(matpower_data['bus']):
        bus_i = int(bus[0])  # 节点编号
        bus_type = int(bus[1])  # 节点类型 (3=slack, 2=PV, 1=PQ)
        
        # 确定节点类型（用于前端显示）
        if bus_type == 3:
            node_type = 'slack'
        elif bus_type == 2:
            node_type = 'generator'  # PV节点通常连接发电机
        else:
            node_type = 'load'
        
        # 获取节点坐标
        coords = matpower_data['bus_coords'].get(bus_i, {'x': 100 + i * 100, 'y': 150})
        
        # 处理功率数据
        active_power = 0
        reactive_power = 0
        
        # 检查该节点是否有发电机连接
        gen_data = None
        for gen in matpower_data['gen']:
            if int(gen[0]) == bus_i:
                gen_data = gen
                break
        
        if gen_data is not None:
            # 有发电机连接的节点
            active_power = float(gen_data[1])  # Pg (发电机有功功率，正值)
            reactive_power = float(gen_data[2])  # Qg (发电机无功功率，正值)
            
            # 如果该节点也有负荷，需要减去负荷功率
            if len(bus) > 2 and bus[2] > 0:
                active_power -= float(bus[2])  # 减去有功负荷
            if len(bus) > 3 and bus[3] > 0:
                reactive_power -= float(bus[3])  # 减去无功负荷
        else:
            # 纯负荷节点
            active_power = -float(bus[2]) if len(bus) > 2 else 0  # Pd (负荷为负)
            reactive_power = -float(bus[3]) if len(bus) > 3 else 0  # Qd (负荷为负)
        
        node = {
            'id': f'bus{bus_i}',
            'type': node_type,
            'x': coords['x'],
            'y': coords['y'],
            'voltage': float(bus[7]) if len(bus) > 7 else 1.0,  # Vm
            'angle': float(np.degrees(bus[8])) if len(bus) > 8 else 0.0,  # Va (转换为度)
            'active_power': active_power,
            'reactive_power': reactive_power
        }
        nodes.append(node)
    
    # 处理线路数据（保持不变）
    for branch in matpower_data['branch']:
        fbus = int(branch[0])  # 起始节点
        tbus = int(branch[1])  # 终止节点
        r = float(branch[2])  # 电阻
        x = float(branch[3])  # 电抗
        
        link = {
            'source': f'bus{fbus}',
            'target': f'bus{tbus}',
            'resistance': r,
            'reactance': x,
            'active_power': 0,  # 初始值，计算后更新
            'reactive_power': 0  # 初始值，计算后更新
        }
        links.append(link)
    
    return {'nodes': nodes, 'links': links}

# 潮流计算函数（使用PyPower牛顿法）
def run_power_flow(nodes, links, method='newton-raphson'):
    """使用PyPower进行牛顿法潮流计算"""
    try:
        if not PYPOWER_AVAILABLE:
            raise ImportError("pypower库未安装，请使用 pip install pypower 安装")
        
        # 创建深拷贝以避免修改原始数据
        nodes_copy = copy.deepcopy(nodes)
        links_copy = copy.deepcopy(links)
        
        # 将JSON数据转换为MATPOWER格式
        node_id_to_idx = {node['id']: i for i, node in enumerate(nodes_copy)}
        
        # 构建bus矩阵
        bus_data = []
        for i, node in enumerate(nodes_copy):
            bus_i = i + 1  # MATPOWER节点编号从1开始
            
            # 确定节点类型（符合PyPower标准）
            if node['type'] == 'slack':
                bus_type = 3  # 平衡节点
            elif node['type'] == 'generator':
                bus_type = 2  # PV节点
            else:
                bus_type = 1  # PQ节点
            
            # 处理负荷数据（确保为正值）
            Pd = max(0, -node['active_power']) if node['type'] == 'load' else 0
            Qd = max(0, -node['reactive_power']) if node['type'] == 'load' else 0
            
            # bus矩阵格式：[bus_i, type, Pd, Qd, Gs, Bs, area, Vm, Va, baseKV, zone, Vmax, Vmin]
            bus_row = [
                bus_i, bus_type, Pd, Qd, 0, 0, 1, 
                node['voltage'], np.radians(node['angle']), 345, 1, 1.1, 0.9
            ]
            bus_data.append(bus_row)
        
        # 构建gen矩阵 - 使用原始输入数据
        gen_data = []
        for i, node in enumerate(nodes_copy):
            if node['type'] in ['slack', 'generator']:
                bus_i = i + 1
                
                # 获取发电机功率（确保为正值）
                Pg = max(0, node['active_power'])
                Qg = max(0, node['reactive_power'])
                
                # 设置发电机参数（符合PyPower标准）
                # gen矩阵格式：[bus_i, Pg, Qg, Qmax, Qmin, Vg, mBase, status, Pmax, Pmin]
                gen_row = [
                    bus_i,                    # 节点编号
                    Pg,                       # 有功功率输出 (MW)
                    Qg,                       # 无功功率输出 (MVAr)
                    300,                      # Qmax (MVAr) - 最大无功输出
                    -300,                     # Qmin (MVAr) - 最小无功输出
                    node['voltage'],          # Vg (pu) - 电压设定值
                    100,                      # mBase (MVA) - 基准功率
                    1,                        # status - 发电机状态 (1=在线)
                    250,                      # Pmax (MW) - 最大有功输出
                    10                        # Pmin (MW) - 最小有功输出
                ]
                gen_data.append(gen_row)
        
        # 构建branch矩阵
        branch_data = []
        for link in links_copy:
            source_id = link['source']['id'] if isinstance(link['source'], dict) else link['source']
            target_id = link['target']['id'] if isinstance(link['target'], dict) else link['target']
            
            fbus = node_id_to_idx[source_id] + 1
            tbus = node_id_to_idx[target_id] + 1
            
            # branch矩阵格式：[fbus, tbus, r, x, b, rateA, rateB, rateC, ratio, angle, status, angmin, angmax]
            branch_row = [
                fbus, tbus, link['resistance'], link['reactance'], 0, 
                0, 0, 0, 0, 0, 1, -360, 360
            ]
            branch_data.append(branch_row)
        
        # 创建MATPOWER格式的case
        ppc = {
            'version': '2',
            'baseMVA': 100.0,
            'bus': np.array(bus_data),
            'gen': np.array(gen_data) if gen_data else np.array([]).reshape(0, 10),
            'branch': np.array(branch_data)
        }
        
        # 使用PyPower进行潮流计算
        logger.info("开始PyPower牛顿法潮流计算")
        results = pp.runpf(ppc)
        
        # 处理计算结果
        if isinstance(results, tuple):
            ppc_result = results[0]
            success = results[1]
            
            if not success:
                logger.error(f"潮流计算未收敛")
                return {
                    'nodes': nodes_copy,
                    'links': links_copy,
                    'converged': False,
                    'error': '潮流计算未收敛，请检查系统数据或调整计算参数',
                    'method': 'pypower-newton'
                }
            
            bus_results = ppc_result['bus']
            branch_results = ppc_result['branch']
            
            # 添加统计计算
            try:
                vm = bus_results[:, 7] if bus_results.shape[1] > 7 else [node['voltage'] for node in nodes_copy]
                
                # 线路负载计算
                if branch_results.shape[1] > 16:
                    # 获取线路两端的有功和无功功率
                    pf_from = branch_results[:, 13]  # 起始端有功功率
                    qf_from = branch_results[:, 14]  # 起始端无功功率
                    pf_to = branch_results[:, 15]    # 末端有功功率
                    qf_to = branch_results[:, 16]    # 末端无功功率
                    
                    # 计算两端视在功率（转换为实际值）
                    apparent_power_from = np.sqrt(pf_from**2 + qf_from**2) * ppc_result['baseMVA']
                    apparent_power_to = np.sqrt(pf_to**2 + qf_to**2) * ppc_result['baseMVA']
                    
                    # 取两端的最大值作为线路负载
                    apparent_power = np.maximum(apparent_power_from, apparent_power_to)
                    
                    # 获取线路额定容量（假设branch_results[:, 5]是MVA容量）
                    rated_capacity = branch_results[:, 5]
                    
                    with np.errstate(divide='ignore', invalid='ignore'):
                        branch_load = (apparent_power / rated_capacity) * 100
                    branch_load[rated_capacity == 0] = 0
                else:
                    branch_load = [0] * len(links_copy)
                
                stats = {
                    'voltage': {
                        'max': round(float(np.max(vm)), 4),
                        'min': round(float(np.min(vm)), 4),
                        'avg': round(float(np.mean(vm)), 4)
                    },
                    'losses': {
                        'P': round(float(np.sum(branch_results[:, 14])), 2) if branch_results.shape[1] > 14 else 0,
                        'Q': round(float(np.sum(branch_results[:, 15])), 2) if branch_results.shape[1] > 15 else 0
                    },
                    'generation': {
                        'total': round(float(np.sum(ppc_result['gen'][:, 1])), 2)
                    },
                    'topology': {
                        'total_branches': len(links_copy),
                        'total_buses': len(nodes_copy),
                        'network_density': round(float(len(links_copy) / (len(nodes_copy) * (len(nodes_copy) - 1) / 2)), 3) if len(nodes_copy) > 1 else 0,
                        'average_connectivity': round(float(len(links_copy) * 2 / len(nodes_copy)), 2) if len(nodes_copy) > 0 else 0
                    }
                }

                  
            except Exception as e:
                logger.warning(f"统计计算失败: {e}")
                stats = {}
            
            logger.info("潮流计算收敛")
            
            # 更新节点计算结果
            for i, node in enumerate(nodes_copy):
                if hasattr(bus_results, 'dtype') and bus_results.dtype.names:
                    node['voltage'] = float(bus_results[i]['VM'])
                    node['angle'] = float(bus_results[i]['VA'])
                else:
                    bus_result = bus_results[i]
                    node['voltage'] = float(bus_result[7])
                    node['angle'] = float(bus_result[8])
                
                # 对于平衡节点和发电节点，更新功率为计算结果
                # 对于负荷节点，保持原始输入数据
                if node['type'] in ['slack', 'generator']:
                    bus_i = int(node['id'].replace('bus', '')) if isinstance(node['id'], str) else int(node['id'])
                    
                    # 从PyPower计算结果中获取发电机功率
                    gen_idx = next((j for j, g in enumerate(ppc_result['gen']) if g[0] == bus_i), None)
                    if gen_idx is not None:
                        node['active_power'] = float(ppc_result['gen'][gen_idx][1])  # Pg
                        node['reactive_power'] = float(ppc_result['gen'][gen_idx][2])  # Qg
                # 对于负荷节点，不修改active_power和reactive_power，保持原始输入数据

            # 更新线路功率
            for i, link in enumerate(links_copy):
                source_id = link['source']['id'] if isinstance(link['source'], dict) else link['source']
                target_id = link['target']['id'] if isinstance(link['target'], dict) else link['target']
                
                def get_matpower_bus_id(node_id):
                    if isinstance(node_id, str):
                        return int(node_id[3:]) if node_id.startswith('bus') else int(node_id)
                    return int(node_id)
                
                source_idx = get_matpower_bus_id(source_id)
                target_idx = get_matpower_bus_id(target_id)
                
                branch_found = False
                for j, branch in enumerate(branch_results):
                    fbus = int(branch[0])
                    tbus = int(branch[1])
                    
                    if (fbus == source_idx and tbus == target_idx) or (fbus == target_idx and tbus == source_idx):
                        branch_found = True
                        
                        if len(branch) >= 17:
                            # 在现有的线路功率更新代码中添加
                            if fbus == source_idx:
                                link['active_power'] = float(branch[13])
                                link['reactive_power'] = float(branch[14])
                                # 添加前端期望的变量
                                link['from_active'] =  float(branch[13])
                                link['from_reactive'] =  float(branch[14])
                                link['to_active'] = - float(branch[15])
                                link['to_reactive'] = - float(branch[16])
                                link['loss_active'] = float(branch[13]) + float(branch[15])
                                link['loss_reactive'] = float(branch[14]) + float(branch[16])
                            else:
                                link['active_power'] = float(branch[13])
                                link['reactive_power'] = float(branch[14])
                                # 添加前端期望的变量（反向）
                                link['from_active'] = - float(branch[15])
                                link['from_reactive'] = - float(branch[16])
                                link['to_active'] = - float(branch[13])
                                link['to_reactive'] = - float(branch[14])
                                link['loss_active'] = float(branch[15]) + float(branch[13])
                                link['loss_reactive'] = float(branch[16]) + float(branch[14])
                        else:
                            if not branch_found:
                                link['active_power'] = 0
                                link['reactive_power'] = 0
                            break
                
                if not branch_found:
                    link['active_power'] = 0
                    link['reactive_power'] = 0
            
            logger.info("线路功率数据处理完成")
            return {
                'nodes': nodes_copy,
                'links': links_copy,
                'converged': True,
                'method': 'pypower-newton',
                'stats': stats
            }
        else:
            logger.warning(f"潮流计算未收敛")
            return {
                'nodes': nodes_copy,
                'links': links_copy,
                'converged': False,
                'error': '潮流计算未收敛',
                'method': 'pypower-newton'
            }
            
    except Exception as e:
        logger.error(f"潮流计算失败: {str(e)}")
        return {
            'nodes': nodes_copy,
            'links': links_copy,
            'converged': False,
            'error': str(e),
            'method': 'pypower-newton'
        }

# 在run_power_flow函数之后，路由定义之前添加load_case_data函数
def load_case_data(case_name):
    """加载指定名称的PyPower案例数据"""
    try:
        if not PYPOWER_AVAILABLE:
            raise ImportError("pypower库未安装，请使用 pip install pypower 安装")
        
        # PyPower内置案例坐标映射
        case_coords = {
            'case9': {
                1: {'x': 100, 'y': 150}, 2: {'x': 200, 'y': 100}, 3: {'x': 300, 'y': 150},
                4: {'x': 400, 'y': 200}, 5: {'x': 500, 'y': 250}, 6: {'x': 600, 'y': 200},
                7: {'x': 700, 'y': 150}, 8: {'x': 800, 'y': 100}, 9: {'x': 900, 'y': 150}
            },
            'case14': {
                1: {'x': 100, 'y': 150}, 2: {'x': 150, 'y': 120}, 3: {'x': 200, 'y': 100},
                4: {'x': 250, 'y': 80}, 5: {'x': 300, 'y': 60}, 6: {'x': 350, 'y': 80},
                7: {'x': 400, 'y': 100}, 8: {'x': 450, 'y': 120}, 9: {'x': 500, 'y': 150},
                10: {'x': 100, 'y': 200}, 11: {'x': 150, 'y': 220}, 12: {'x': 200, 'y': 240},
                13: {'x': 250, 'y': 260}, 14: {'x': 300, 'y': 280}
            },
            'case30': {
                1: {'x': 100, 'y': 150}, 2: {'x': 150, 'y': 120}, 3: {'x': 200, 'y': 100},
                4: {'x': 250, 'y': 80}, 5: {'x': 300, 'y': 60}, 6: {'x': 350, 'y': 80},
                7: {'x': 400, 'y': 100}, 8: {'x': 450, 'y': 120}, 9: {'x': 500, 'y': 150},
                10: {'x': 100, 'y': 200}, 11: {'x': 150, 'y': 220}, 12: {'x': 200, 'y': 240},
                13: {'x': 250, 'y': 260}, 14: {'x': 300, 'y': 280}, 15: {'x': 350, 'y': 260},
                16: {'x': 400, 'y': 240}, 17: {'x': 450, 'y': 220}, 18: {'x': 500, 'y': 200},
                19: {'x': 550, 'y': 150}, 20: {'x': 600, 'y': 120}, 21: {'x': 650, 'y': 100},
                22: {'x': 700, 'y': 80}, 23: {'x': 750, 'y': 60}, 24: {'x': 800, 'y': 80},
                25: {'x': 850, 'y': 100}, 26: {'x': 900, 'y': 120}, 27: {'x': 950, 'y': 150},
                28: {'x': 1000, 'y': 200}, 29: {'x': 1050, 'y': 250}, 30: {'x': 1100, 'y': 300}
            }
        }
        
        # 使用直接导入的方式获取案例数据
        case_functions = {
            'case9': case9.case9,
            'case14': case14.case14,
            'case30': case30.case30,
            'case39': case39.case39,
            'case57': case57.case57,
            'case118': case118.case118,
        }
        
        if case_name in case_functions:
            case_data = case_functions[case_name]()
            # 添加节点坐标
            if case_name in case_coords:
                case_data['bus_coords'] = case_coords[case_name]
            else:
                # 如果没有预定义坐标，自动生成
                bus_coords = {}
                for i, bus in enumerate(case_data['bus']):
                    bus_id = int(bus[0])
                    bus_coords[bus_id] = {
                        'x': 100 + (i % 10) * 100,
                        'y': 100 + (i // 10) * 100
                    }
                case_data['bus_coords'] = bus_coords
            
            logger.info(f"成功加载PyPower内置{case_name}数据")
            return matpower_to_json(case_data)
        else:
            # 尝试加载本地文件
            local_path = os.path.join(DATA_DIR, f'{case_name}.m')
            if os.path.exists(local_path):
                try:
                    matpower_data = parse_matpower_file(local_path)
                    logger.info(f"使用本地{case_name}.m文件")
                    return matpower_to_json(matpower_data)
                except Exception as e:
                    logger.warning(f"无法解析{case_name}.m文件: {e}")
            
            # 如果都失败，返回默认数据
            logger.warning(f"无法加载{case_name}，使用默认4节点数据")
            return {
                'nodes': [
                    {'id': 'bus1', 'type': 'slack', 'x': 100, 'y': 150, 'voltage': 1.0, 'angle': 0.0, 'active_power': 0, 'reactive_power': 0},
                    {'id': 'bus2', 'type': 'load', 'x': 200, 'y': 100, 'voltage': 1.0, 'angle': 0.0, 'active_power': -80, 'reactive_power': -30},
                    {'id': 'bus3', 'type': 'load', 'x': 300, 'y': 150, 'voltage': 1.0, 'angle': 0.0, 'active_power': -60, 'reactive_power': -20},
                    {'id': 'bus4', 'type': 'generator', 'x': 200, 'y': 200, 'voltage': 1.0, 'angle': 0.0, 'active_power': 150, 'reactive_power': 75}
                ],
                'links': [
                    {'source': 'bus1', 'target': 'bus2', 'resistance': 0.02, 'reactance': 0.06, 'active_power': 0, 'reactive_power': 0},
                    {'source': 'bus1', 'target': 'bus3', 'resistance': 0.03, 'reactance': 0.08, 'active_power': 0, 'reactive_power': 0},
                    {'source': 'bus2', 'target': 'bus4', 'resistance': 0.01, 'reactance': 0.03, 'active_power': 0, 'reactive_power': 0},
                    {'source': 'bus3', 'target': 'bus4', 'resistance': 0.02, 'reactance': 0.05, 'active_power': 0, 'reactive_power': 0}
                ]
            }
    except Exception as e:
        logger.error(f"加载{case_name}数据失败: {str(e)}")
        raise Exception(f"加载{case_name}数据失败: {str(e)}")

# 路由：主页
@app.route('/')
def index():
    # 提供默认的统计数据，避免模板渲染错误
    default_stats = {
        'voltage': {'max': 0, 'min': 0, 'avg': 0},
        'losses': {'P': 0, 'Q': 0},
        'generation': {'total': 0},
        'branch': {'max_load': 0, 'max_id': 0, 'avg_load': 0, 'overload_count': 0},
        'topology': {
            'total_branches': 0,
            'total_nodes': 0,
            'network_density': 0,
            'avg_connectivity': 0
        }
    }
    return render_template('index.html', stats=default_stats)

# 路由：获取电网数据
@app.route('/api/grid-data', methods=['GET'])
def load_grid_data():
    """加载电网数据，优先使用pypower内置数据，回退到本地文件"""
    try:
        if PYPOWER_AVAILABLE:
            # 尝试使用pypower内置的case30数据
            try:
                case30 = pp.case30()
                # 添加节点坐标（因为pypower内置数据不包含坐标）
                bus_coords = {
                    1: {'x': 100, 'y': 150}, 2: {'x': 150, 'y': 120}, 3: {'x': 200, 'y': 100},
                    4: {'x': 250, 'y': 80}, 5: {'x': 300, 'y': 60}, 6: {'x': 350, 'y': 80},
                    7: {'x': 400, 'y': 100}, 8: {'x': 450, 'y': 120}, 9: {'x': 500, 'y': 150},
                    10: {'x': 100, 'y': 200}, 11: {'x': 150, 'y': 220}, 12: {'x': 200, 'y': 240},
                    13: {'x': 250, 'y': 260}, 14: {'x': 300, 'y': 280}, 15: {'x': 350, 'y': 260},
                    16: {'x': 400, 'y': 240}, 17: {'x': 450, 'y': 220}, 18: {'x': 500, 'y': 200},
                    19: {'x': 550, 'y': 150}, 20: {'x': 600, 'y': 120}, 21: {'x': 650, 'y': 100},
                    22: {'x': 700, 'y': 80}, 23: {'x': 750, 'y': 60}, 24: {'x': 800, 'y': 80},
                    25: {'x': 850, 'y': 100}, 26: {'x': 900, 'y': 120}, 27: {'x': 950, 'y': 150},
                    28: {'x': 1000, 'y': 200}, 29: {'x': 1050, 'y': 250}, 30: {'x': 1100, 'y': 300}
                }
                case30['bus_coords'] = bus_coords
                logger.info("使用pypower内置case30数据")
                return matpower_to_json(case30)
            except Exception as e:
                logger.warning(f"无法加载pypower内置case30数据: {e}")
        
        case30_path = os.path.join(DATA_DIR, 'case30.m')
        if os.path.exists(case30_path):
            try:
                matpower_data = parse_matpower_file(case30_path)
                logger.info("使用本地case30.m文件")
                return matpower_to_json(matpower_data)
            except Exception as e:
                logger.warning(f"无法解析case30.m文件: {e}")
        
        # 尝试读取本地case9.m文件
        case9_path = os.path.join(DATA_DIR, 'case9.m')
        if os.path.exists(case9_path):
            try:
                matpower_data = parse_matpower_file(case9_path)
                logger.info("使用本地case9.m文件")
                return matpower_to_json(matpower_data)
            except Exception as e:
                logger.warning(f"无法解析case9.m文件: {e}")
        
        # 尝试读取JSON格式的电网数据
        json_path = os.path.join(DATA_DIR, 'grid_data.json')
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                logger.info("使用本地JSON数据")
                return data
            except Exception as e:
                logger.warning(f"无法读取JSON数据: {e}")
        
        # 使用默认的4节点数据
        logger.info("使用默认4节点数据")
        return {
            'nodes': [
                {'id': 'bus1', 'type': 'slack', 'x': 100, 'y': 150, 'voltage': 1.0, 'angle': 0.0, 'active_power': 0, 'reactive_power': 0},
                {'id': 'bus2', 'type': 'load', 'x': 200, 'y': 100, 'voltage': 1.0, 'angle': 0.0, 'active_power': -80, 'reactive_power': -30},
                {'id': 'bus3', 'type': 'load', 'x': 300, 'y': 150, 'voltage': 1.0, 'angle': 0.0, 'active_power': -60, 'reactive_power': -20},
                {'id': 'bus4', 'type': 'generator', 'x': 200, 'y': 200, 'voltage': 1.0, 'angle': 0.0, 'active_power': 150, 'reactive_power': 75}
            ],
            'links': [
                {'source': 'bus1', 'target': 'bus2', 'resistance': 0.02, 'reactance': 0.06, 'active_power': 0, 'reactive_power': 0},
                {'source': 'bus1', 'target': 'bus3', 'resistance': 0.03, 'reactance': 0.08, 'active_power': 0, 'reactive_power': 0},
                {'source': 'bus2', 'target': 'bus4', 'resistance': 0.01, 'reactance': 0.03, 'active_power': 0, 'reactive_power': 0},
                {'source': 'bus3', 'target': 'bus4', 'resistance': 0.02, 'reactance': 0.05, 'active_power': 0, 'reactive_power': 0}
            ]
        }
    
    except Exception as e:
        logger.error(f"加载电网数据失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 路由：执行潮流计算
@app.route('/api/calculate-flow', methods=['POST'])
def calculate_power_flow():
    try:
        data = request.get_json()
        nodes = data.get('nodes', [])
        links = data.get('links', [])
        
        # 使用PyPower牛顿法进行计算
        result = run_power_flow(nodes, links, method='newton-raphson')
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"潮流计算失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 路由：保存电网数据
@app.route('/api/save-grid', methods=['POST'])
def save_grid_data():
    try:
        data = request.get_json()
        file_path = os.path.join(DATA_DIR, 'grid_data.json')
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"保存电网数据失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 路由：加载指定案例数据
@app.route('/api/load-case', methods=['POST'])
def api_load_case():
    try:
        data = request.get_json()
        case_name = data.get('case')
        
        if not case_name:
            return jsonify({'error': '缺少案例名称参数'}), 400
        
        # 调用load_case_data函数加载指定案例
        result = load_case_data(case_name)
        return jsonify(result)
    except Exception as e:
        logger.error(f"加载案例数据失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
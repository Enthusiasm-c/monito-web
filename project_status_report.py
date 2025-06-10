#!/usr/bin/env python3
"""
Project Status Report Generator
Comprehensive analysis of the Monito-Web pipeline system
"""

import sys
import os
import json
import subprocess
from pathlib import Path
from datetime import datetime

def analyze_project_structure():
    """Analyze project structure and components"""
    
    report = {
        'project_info': {
            'name': 'Monito-Web Supplier Price Comparison Platform',
            'analysis_date': datetime.now().isoformat(),
            'project_root': str(Path.cwd())
        },
        'pipeline_components': {},
        'test_coverage': {},
        'implementation_status': {},
        'dependencies': {},
        'recommendations': []
    }
    
    # Analyze pipeline components
    pipeline_dir = Path('src/pipeline')
    if pipeline_dir.exists():
        components = {}
        
        for file in pipeline_dir.glob('*.py'):
            file_size = file.stat().st_size
            components[file.name] = {
                'size_bytes': file_size,
                'size_kb': round(file_size / 1024, 2),
                'last_modified': datetime.fromtimestamp(file.stat().st_mtime).isoformat()
            }
        
        for file in pipeline_dir.glob('*.ts'):
            file_size = file.stat().st_size
            components[file.name] = {
                'size_bytes': file_size,
                'size_kb': round(file_size / 1024, 2),
                'last_modified': datetime.fromtimestamp(file.stat().st_mtime).isoformat()
            }
        
        report['pipeline_components'] = components
    
    # Analyze test files
    tests_dir = Path('tests')
    if tests_dir.exists():
        test_files = {}
        
        for file in tests_dir.glob('test_*.py'):
            file_size = file.stat().st_size
            test_files[file.name] = {
                'size_bytes': file_size,
                'size_kb': round(file_size / 1024, 2),
                'last_modified': datetime.fromtimestamp(file.stat().st_mtime).isoformat()
            }
        
        report['test_coverage'] = test_files
    
    # Sprint tasks implementation status
    sprint_tasks = {
        'Task 1': 'Document Classification with MIME + Hash',
        'Task 2': 'PDF Text Extraction and OCR Fallback', 
        'Task 3': 'Image Preprocessing for Menu Readability',
        'Task 4': 'Unified XLSX Reading for All Sheets',
        'Task 5': 'Rule-based Table Extraction',
        'Task 6': 'AI Structuring with Function Calling',
        'Task 7': 'Product Normalization with Fuzzy Matching',
        'Task 8': 'Composite Price Parsing',
        'Task 9': 'AI Response Caching with Redis',
        'Task 10': 'Batch Database Operations',
        'Task 11': 'Logging and Metrics with Structlog',
        'Task 12': 'Auto-tests and Validation',
        'Task 13': 'Developer Documentation',
        'Task 14': 'CI/CD with GitHub Actions'
    }
    
    # Check implementation files
    implementation_status = {}
    for task_name, description in sprint_tasks.items():
        # Map tasks to expected files
        task_files = []
        
        if 'Document Classification' in description:
            task_files = ['document_classifier.py', 'document_classifier_service.ts']
        elif 'PDF Text' in description:
            task_files = ['pdf_text_extractor.py', 'pdf_text_service.ts']
        elif 'Image Preprocessing' in description:
            task_files = ['image_preprocessor.py', 'image_preprocessing_service.ts']
        elif 'XLSX Reading' in description:
            task_files = ['excel_reader.py', 'excel_reading_service.ts']
        elif 'Table Extraction' in description:
            task_files = ['table_extractor.py']
        elif 'AI Structuring' in description:
            task_files = ['ai_structuring_service.py', 'ai_structuring_service.ts']
        elif 'Product Normalization' in description:
            task_files = ['product_normalizer.py']
        elif 'Price Parsing' in description:
            task_files = ['price_parser.py', 'price_parsing_service.ts']
        elif 'AI Response Caching' in description:
            task_files = ['ai_cache_service.py', 'ai_cache_integration.ts']
        elif 'Batch Database' in description:
            task_files = ['batch_database_service.py', 'batch_database_integration.ts']
        elif 'Logging and Metrics' in description:
            task_files = ['logging_service.py', 'logging_integration.ts']
        elif 'Auto-tests' in description:
            task_files = ['test_complete_pipeline_integration.py', 'test_pipeline_basic.py']
        
        # Check if files exist
        files_status = {}
        for file in task_files:
            file_path = pipeline_dir / file if not file.startswith('test_') else Path('tests') / file
            if not file_path.exists():
                file_path = Path('.') / file  # Check root directory
            
            files_status[file] = {
                'exists': file_path.exists(),
                'path': str(file_path) if file_path.exists() else 'Not found'
            }
        
        implementation_status[task_name] = {
            'description': description,
            'files': files_status,
            'completion': sum(1 for f in files_status.values() if f['exists']) / len(files_status) if files_status else 0
        }
    
    report['implementation_status'] = implementation_status
    
    return report

def check_dependencies():
    """Check system dependencies and their availability"""
    
    dependencies = {
        'python_packages': {
            'required': ['fastapi', 'pytest', 'structlog', 'redis', 'pandas'],
            'optional': ['rapidfuzz', 'pint', 'psutil', 'psycopg2', 'asyncpg', 'opencv-python', 'pillow'],
            'ai_related': ['openai', 'anthropic']
        },
        'system_dependencies': {
            'required': ['python3', 'node', 'npm'],
            'optional': ['redis-server', 'postgresql', 'tesseract', 'poppler-utils']
        }
    }
    
    status = {
        'python_packages': {},
        'system_dependencies': {}
    }
    
    # Check Python packages
    for category, packages in dependencies['python_packages'].items():
        status['python_packages'][category] = {}
        for package in packages:
            try:
                __import__(package)
                status['python_packages'][category][package] = 'Available'
            except ImportError:
                status['python_packages'][category][package] = 'Missing'
    
    # Check system dependencies
    for category, commands in dependencies['system_dependencies'].items():
        status['system_dependencies'][category] = {}
        for command in commands:
            try:
                result = subprocess.run(['which', command], capture_output=True, text=True)
                status['system_dependencies'][category][command] = 'Available' if result.returncode == 0 else 'Missing'
            except:
                status['system_dependencies'][category][command] = 'Missing'
    
    return status

def generate_recommendations(report):
    """Generate recommendations based on analysis"""
    
    recommendations = []
    
    # Check implementation completeness
    incomplete_tasks = []
    for task, details in report['implementation_status'].items():
        if details['completion'] < 1.0:
            incomplete_tasks.append(f"{task}: {details['completion']*100:.0f}% complete")
    
    if incomplete_tasks:
        recommendations.append({
            'category': 'Implementation',
            'priority': 'Medium',
            'issue': 'Some tasks are not fully implemented',
            'details': incomplete_tasks,
            'action': 'Complete missing implementation files'
        })
    
    # Check test coverage
    test_files = report['test_coverage']
    if len(test_files) < 5:
        recommendations.append({
            'category': 'Testing',
            'priority': 'High',
            'issue': f'Limited test coverage: only {len(test_files)} test files found',
            'action': 'Add more comprehensive test coverage for all components'
        })
    
    # Check component sizes (potential issues with very large files)
    large_files = []
    for file, details in report['pipeline_components'].items():
        if details['size_kb'] > 50:  # Files larger than 50KB
            large_files.append(f"{file}: {details['size_kb']}KB")
    
    if large_files:
        recommendations.append({
            'category': 'Code Quality',
            'priority': 'Low',
            'issue': 'Some files are quite large',
            'details': large_files,
            'action': 'Consider refactoring large files into smaller modules'
        })
    
    # Dependencies recommendations
    dependencies = check_dependencies()
    missing_required = []
    missing_optional = []
    
    for package, status in dependencies['python_packages']['required'].items():
        if status == 'Missing':
            missing_required.append(package)
    
    for package, status in dependencies['python_packages']['optional'].items():
        if status == 'Missing':
            missing_optional.append(package)
    
    if missing_required:
        recommendations.append({
            'category': 'Dependencies',
            'priority': 'High',
            'issue': 'Missing required dependencies',
            'details': missing_required,
            'action': 'Install missing required packages'
        })
    
    if missing_optional:
        recommendations.append({
            'category': 'Dependencies',
            'priority': 'Medium',
            'issue': 'Missing optional dependencies that enhance functionality',
            'details': missing_optional,
            'action': 'Consider installing optional packages for full functionality'
        })
    
    return recommendations

def main():
    """Generate comprehensive project status report"""
    
    print("🔍 Analyzing Monito-Web Pipeline Project...")
    print("=" * 60)
    
    # Generate report
    report = analyze_project_structure()
    dependencies = check_dependencies()
    recommendations = generate_recommendations(report)
    
    report['dependencies'] = dependencies
    report['recommendations'] = recommendations
    
    # Display summary
    print(f"\n📊 PROJECT ANALYSIS SUMMARY")
    print(f"Analysis Date: {report['project_info']['analysis_date']}")
    print(f"Project Root: {report['project_info']['project_root']}")
    
    print(f"\n🔧 PIPELINE COMPONENTS")
    print(f"Total Components: {len(report['pipeline_components'])}")
    
    python_files = [f for f in report['pipeline_components'].keys() if f.endswith('.py')]
    typescript_files = [f for f in report['pipeline_components'].keys() if f.endswith('.ts')]
    
    print(f"Python Files: {len(python_files)}")
    print(f"TypeScript Files: {len(typescript_files)}")
    
    total_size = sum(details['size_kb'] for details in report['pipeline_components'].values())
    print(f"Total Code Size: {total_size:.1f} KB")
    
    print(f"\n🧪 TEST COVERAGE")
    print(f"Test Files: {len(report['test_coverage'])}")
    test_size = sum(details['size_kb'] for details in report['test_coverage'].values())
    print(f"Test Code Size: {test_size:.1f} KB")
    
    print(f"\n✅ IMPLEMENTATION STATUS")
    completed_tasks = sum(1 for task in report['implementation_status'].values() if task['completion'] == 1.0)
    total_tasks = len(report['implementation_status'])
    completion_rate = (completed_tasks / total_tasks) * 100
    
    print(f"Completed Tasks: {completed_tasks}/{total_tasks} ({completion_rate:.1f}%)")
    
    for task, details in report['implementation_status'].items():
        status = "✅" if details['completion'] == 1.0 else "⚠️" if details['completion'] > 0.5 else "❌"
        print(f"  {status} {task}: {details['completion']*100:.0f}%")
    
    print(f"\n📦 DEPENDENCIES STATUS")
    
    # Required Python packages
    required_status = dependencies['python_packages']['required']
    available_required = sum(1 for status in required_status.values() if status == 'Available')
    print(f"Required Python Packages: {available_required}/{len(required_status)}")
    
    for package, status in required_status.items():
        icon = "✅" if status == "Available" else "❌"
        print(f"  {icon} {package}: {status}")
    
    # Optional Python packages
    optional_status = dependencies['python_packages']['optional']
    available_optional = sum(1 for status in optional_status.values() if status == 'Available')
    print(f"\nOptional Python Packages: {available_optional}/{len(optional_status)}")
    
    for package, status in optional_status.items():
        icon = "✅" if status == "Available" else "⚠️"
        print(f"  {icon} {package}: {status}")
    
    print(f"\n💡 RECOMMENDATIONS")
    if recommendations:
        for i, rec in enumerate(recommendations, 1):
            priority_icon = "🔴" if rec['priority'] == 'High' else "🟡" if rec['priority'] == 'Medium' else "🟢"
            print(f"{i}. {priority_icon} [{rec['category']}] {rec['issue']}")
            print(f"   Action: {rec['action']}")
            if 'details' in rec:
                print(f"   Details: {', '.join(rec['details'][:3])}{'...' if len(rec['details']) > 3 else ''}")
    else:
        print("🎉 No major issues found! Project is in good shape.")
    
    print(f"\n🎯 OVERALL PROJECT HEALTH")
    
    # Calculate overall health score
    health_factors = {
        'implementation_completion': completion_rate / 100,
        'test_coverage': min(len(report['test_coverage']) / 10, 1.0),  # Normalize to max 10 test files
        'dependencies': available_required / len(required_status),
        'code_quality': 1.0 - (len([r for r in recommendations if r['priority'] == 'High']) * 0.2)
    }
    
    overall_health = sum(health_factors.values()) / len(health_factors) * 100
    
    if overall_health >= 90:
        health_status = "🎉 Excellent"
        health_color = "green"
    elif overall_health >= 75:
        health_status = "✅ Good"
        health_color = "green"
    elif overall_health >= 60:
        health_status = "⚠️ Fair"
        health_color = "yellow"
    else:
        health_status = "❌ Needs Attention"
        health_color = "red"
    
    print(f"Overall Health Score: {overall_health:.1f}% - {health_status}")
    
    print(f"\nHealth Factors:")
    for factor, score in health_factors.items():
        print(f"  - {factor.replace('_', ' ').title()}: {score*100:.1f}%")
    
    # Save detailed report
    report_file = Path('project_status_report.json')
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n📄 Detailed report saved to: {report_file}")
    
    print("\n" + "=" * 60)
    print("🏁 PROJECT ANALYSIS COMPLETED")
    
    return overall_health >= 75

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
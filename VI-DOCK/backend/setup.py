from setuptools import setup, find_packages

setup(
    name="vidock",
    version="3.1.0",
    packages=find_packages(),
    install_requires=[
        "customtkinter>=5.2.0",
        "requests>=2.25.1",
    ],
    python_requires='>=3.8',
    entry_points={
        'console_scripts': [
            'vidock=main:main',
        ],
    },
    include_package_data=True,
    package_data={
        'vidock': ['*.json'],
    },
    author="Arjun Subbaraman",
    author_email="Arjun.subbaraman13@gmail.com",
    description="Advanced Molecular Docking GUI with ChimeraX integration",
    keywords="docking vina chimerax molecular visualization",
    url="https://github.com/messiay/vidock",
)